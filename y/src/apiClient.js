// Browser persistence layer for Vercel/serverless deployments.
// It keeps the shop data available after refreshes even when the server
// instance is replaced. The API is still used when available.

const STORAGE_KEY = "abu_al_khair_shop_data_v3";
const STORAGE_READY_KEY = "abu_al_khair_shop_data_v3_ready";
const originalFetch = window.fetch.bind(window);
// Expose the real network fetch so pages can force-refresh server data when needed.
window.__abuAlKhairOriginalFetch = originalFetch;

const emptyState = {
  customers: [],
  devices: [],
  controllers: [],
  invoices: [],
  products: [],
  movements: [],
};

function readState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...emptyState };
    return { ...emptyState, ...JSON.parse(raw) };
  } catch {
    return { ...emptyState };
  }
}

function readLegacyState() {
  try {
    const raw = localStorage.getItem("abu_al_khair_shop_data_v2");
    if (!raw) return null;
    const parsed = { ...emptyState, ...JSON.parse(raw) };
    const hasData = Object.values(parsed).some(
      (value) => Array.isArray(value) && value.length > 0
    );
    return hasData ? parsed : null;
  } catch {
    return null;
  }
}

function writeState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    localStorage.setItem(STORAGE_READY_KEY, "1");
  } catch (error) {
    console.warn("Local storage save failed", error);
  }
}

function responseJson(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function resourceFromUrl(url) {
  const parsed = new URL(url, window.location.origin);
  const match = parsed.pathname.match(/^\/api\/([^/]+)/);
  return match ? match[1] : null;
}

function idFromUrl(url) {
  const parsed = new URL(url, window.location.origin);
  const parts = parsed.pathname.split("/").filter(Boolean);
  const last = parts[parts.length - 1];
  return /^\d+$/.test(last) ? Number(last) : null;
}

function nextId(items) {
  return items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
}

function customerJoin(state, customerId) {
  const customer = state.customers.find(
    (item) => Number(item.id) === Number(customerId)
  );
  return {
    customer_name: customer?.name || "-",
    customer_phone: customer?.phone || "-",
  };
}

function enrich(resource, item, state) {
  if (resource === "devices" || resource === "controllers") {
    return { ...item, ...customerJoin(state, item.customer_id) };
  }
  return item;
}

function parseBody(init) {
  try {
    if (!init?.body) return {};
    return typeof init.body === "string" ? JSON.parse(init.body) : init.body;
  } catch {
    return {};
  }
}

function localGet(url, resource, state) {
  let data = Array.isArray(state[resource]) ? state[resource] : [];
  const parsed = new URL(url, window.location.origin);
  const search = parsed.searchParams.get("search")?.trim().toLowerCase();

  if (search && (resource === "devices" || resource === "controllers")) {
    data = data.filter((item) =>
      [
        item.label_number,
        item.customer_name,
        item.customer_phone,
        item.serial_number,
        item.model,
        item.device_type,
        item.controller_type,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search))
    );
  }

  return data.map((item) => enrich(resource, item, state));
}

async function fallbackMutation(url, init, resource, state) {
  const method = (init?.method || "GET").toUpperCase();
  const body = parseBody(init);
  const id = idFromUrl(url);
  const items = Array.isArray(state[resource]) ? [...state[resource]] : [];

  if (method === "POST") {
    const newId = nextId(items);
    const now = new Date().toISOString();
    let item = { ...body, id: newId, created_at: now, received_at: now };

    if (resource === "customers") {
      item = { id: newId, name: body.name || "", phone: body.phone || "", notes: body.notes || "", created_at: now };
    } else if (resource === "devices") {
      item.label_number = body.label_number || `D-${String(newId).padStart(5, "0")}`;
      item.status = body.status || "داخل المحل";
      item.received_at = now;
    } else if (resource === "controllers") {
      item.label_number = body.label_number || `C-${String(newId).padStart(5, "0")}`;
      item.status = body.status || "داخل المحل";
      item.quantity = Number(body.quantity || 1);
      item.condition = body.condition || "Original";
      item.repair_cost = Number(body.repair_cost || 0);
      item.received_at = now;
    } else if (resource === "invoices") {
      item.invoiceNumber = body.invoiceNumber || `INV-${new Date().toISOString().slice(0,10).replaceAll("-", "")}-${String(newId).padStart(4, "0")}`;
      item.invoice_number = item.invoiceNumber;
    } else if (resource === "products") {
      item.purchase_price = Number(body.purchase_price || 0);
      item.sale_price = Number(body.sale_price || 0);
    }

    state[resource] = [item, ...items];
    writeState(state);
    return responseJson(enrich(resource, item, state), 201);
  }

  if (method === "PUT" || method === "PATCH") {
    const index = items.findIndex((item) => Number(item.id) === Number(id));
    if (index < 0) return responseJson({ message: "العنصر غير موجود" }, 404);
    const updated = { ...items[index], ...body, id: items[index].id };
    state[resource] = items.map((item, i) => (i === index ? updated : item));
    writeState(state);
    return responseJson(enrich(resource, updated, state));
  }

  if (method === "DELETE") {
    const exists = items.some((item) => Number(item.id) === Number(id));
    if (!exists) return responseJson({ message: "العنصر غير موجود" }, 404);
    state[resource] = items.filter((item) => Number(item.id) !== Number(id));
    writeState(state);
    return responseJson({ message: "تم الحذف بنجاح" });
  }

  return responseJson(localGet(url, resource, state));
}

async function smartFetch(input, init = {}) {
  const url = typeof input === "string" ? input : input.url;
  const resource = resourceFromUrl(url);
  if (!resource) return originalFetch(input, init);

  const method = (init?.method || (typeof input !== "string" ? input.method : "GET") || "GET").toUpperCase();
  let state = readState();
  const hasLocalDatabase = localStorage.getItem(STORAGE_READY_KEY) === "1";
  const legacyState = !hasLocalDatabase ? readLegacyState() : null;
  if (legacyState) state = legacyState;

  // After the first successful load or any mutation, the browser database
  // becomes the source of truth. This is important on Vercel because
  // serverless /tmp storage is temporary between function instances.
  if (method === "GET" && hasLocalDatabase) {
    return responseJson(localGet(url, resource, state));
  }

  try {
    const response = await originalFetch(input, init);
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : {}; } catch { data = null; }

    if (method === "GET" && response.ok && data !== null) {
      if (Array.isArray(data)) {
        // Preserve legacy local records while importing the server records.
        // Local records win when IDs collide, so previous edits are not lost.
        const localItems = Array.isArray(state[resource]) ? state[resource] : [];
        const byId = new Map(data.map((item) => [Number(item.id), item]));
        for (const item of localItems) {
          if (item?.id != null) byId.set(Number(item.id), item);
        }
        state[resource] = Array.from(byId.values()).sort(
          (a, b) => Number(b.id || 0) - Number(a.id || 0)
        );
      }
      writeState(state);
      return responseJson(localGet(url, resource, state), response.status);
    }

    if (method !== "GET" && response.ok && data !== null) {
      if (method === "POST" && data?.id != null) {
        state[resource] = [data, ...(state[resource] || []).filter((x) => Number(x.id) !== Number(data.id))];
        writeState(state);
      } else if ((method === "PUT" || method === "PATCH") && data?.id != null) {
        state[resource] = (state[resource] || []).map((x) => Number(x.id) === Number(data.id) ? data : x);
        writeState(state);
      } else if (method === "DELETE") {
        const id = idFromUrl(url);
        state[resource] = (state[resource] || []).filter((x) => Number(x.id) !== Number(id));
        writeState(state);
      }
      return responseJson(data, response.status);
    }

    // HTML/error response: keep the app usable locally instead of showing JSON errors.
    return await fallbackMutation(url, init, resource, state);
  } catch {
    return await fallbackMutation(url, init, resource, state);
  }
}

window.fetch = smartFetch;

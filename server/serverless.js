const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const { neon, Pool, neonConfig } = require("@neondatabase/serverless");

// Pool() needs a WebSocket implementation to hold a session open for the
// transaction/lock used below. Node 22 (this project's target) has a
// native WebSocket global, but we point at the `ws` package explicitly
// so this also works on older Node runtimes without extra setup.
if (!neonConfig.webSocketConstructor) {
  try {
    neonConfig.webSocketConstructor = require("ws");
  } catch {
    // falls back to the native global WebSocket if `ws` isn't installed
  }
}

const app = express();


app.use(cors());
app.use(express.json());

/*
========================================
DATABASE
========================================
*/

// مهم جدًا:
// server.js موجود داخل مجلد server
// وقاعدة البيانات موجودة في المجلد الرئيسي
//
// AbuAlKhairSystem
// ├── abuAlkhair.db
// └── server
//     └── server.js

const sourceDbPath = path.join(__dirname, "..", "abuAlkhair.db");
const dbPath = path.join("/tmp", "abuAlkhair.db");

if (!fs.existsSync(dbPath) && fs.existsSync(sourceDbPath)) {
  fs.copyFileSync(sourceDbPath, dbPath);
}

console.log("Database:", dbPath);

let db = new Database(dbPath);

db.pragma("foreign_keys = ON");

/*
========================================
CREATE TABLES + MIGRATIONS + BACKFILL
========================================
IMPORTANT: this used to run once at cold-start, against whatever local
copy happened to exist at that moment. Once real data started being
hydrated from Postgres on every request (see VERCEL / NEON PERSISTENCE
below), that meant this code was applying migrations to a throwaway
copy of the database instead of the real one. It's now wrapped in a
function so it can be re-run every time a fresh copy of the database
is loaded from Postgres, guaranteeing the schema is always correct no
matter how old the stored copy is.
*/

function ensureSchema() {
  createTables();
  runMigrations();
  backfillLabels();
}

function createTables() {
  db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    serial_number TEXT,
    purchase_price REAL DEFAULT 0,
    sale_price REAL DEFAULT 0,
    warranty_months INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT NOT NULL UNIQUE,
    customer_id INTEGER,
    total REAL DEFAULT 0,
    payment_method TEXT,
    sale_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id)
      REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL,
    product_id INTEGER,
    product_name TEXT NOT NULL,
    serial_number TEXT,
    quantity INTEGER DEFAULT 1,
    price REAL DEFAULT 0,
    warranty_months INTEGER DEFAULT 0,
    warranty_end TEXT,
    FOREIGN KEY (sale_id)
      REFERENCES sales(id)
      ON DELETE CASCADE,
    FOREIGN KEY (product_id)
      REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    device_type TEXT NOT NULL,
    model TEXT,
    serial_number TEXT,
    status TEXT NOT NULL DEFAULT 'داخل المحل',
    received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    delivered_at TEXT,
    notes TEXT,
    label_number TEXT,
    FOREIGN KEY (customer_id)
      REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS controllers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    controller_type TEXT NOT NULL,
    model TEXT,
    serial_number TEXT,
    status TEXT NOT NULL DEFAULT 'داخل المحل',
    received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    delivered_at TEXT,
    notes TEXT,
    label_number TEXT,
    FOREIGN KEY (customer_id)
      REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER,
    product_id INTEGER,
    customer_id INTEGER,
    reason TEXT,
    return_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (sale_id)
      REFERENCES sales(id),
    FOREIGN KEY (product_id)
      REFERENCES products(id),
    FOREIGN KEY (customer_id)
      REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_type TEXT NOT NULL,
    record_id INTEGER NOT NULL,
    customer_id INTEGER,
    action TEXT NOT NULL,
    status TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id)
      REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

  const seedSetting = db.prepare(`
    INSERT OR IGNORE INTO app_settings (key, value)
    VALUES (?, ?)
  `);

  seedSetting.run("admin_username", "admin");
  seedSetting.run("admin_password", "1234");
  seedSetting.run("shop_name", "ABU AL-KHAIR GAMING SHOP");
}

/*
========================================
HELPER
========================================
*/

function getColumns(tableName) {
  return db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all()
    .map((column) => column.name);
}

function runMigrations() {
  // DEVICES

  let deviceColumns = getColumns("devices");

  if (!deviceColumns.includes("label_number")) {
    db.exec(`
      ALTER TABLE devices
      ADD COLUMN label_number TEXT
    `);
  }

  // CONTROLLERS

  let controllerColumns = getColumns("controllers");

  if (!controllerColumns.includes("quantity")) {
    db.exec(`
      ALTER TABLE controllers
      ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1
    `);
  }

  if (!controllerColumns.includes("condition")) {
    db.exec(`
      ALTER TABLE controllers
      ADD COLUMN condition TEXT NOT NULL DEFAULT 'Original'
    `);
  }

  if (!controllerColumns.includes("repair_cost")) {
    db.exec(`
      ALTER TABLE controllers
      ADD COLUMN repair_cost REAL NOT NULL DEFAULT 0
    `);
  }

  if (!controllerColumns.includes("label_number")) {
    db.exec(`
      ALTER TABLE controllers
      ADD COLUMN label_number TEXT
    `);
  }

  // SALE ITEMS

  let saleItemColumns = getColumns("sale_items");

  if (!saleItemColumns.includes("serial_number")) {
    db.exec(`
      ALTER TABLE sale_items
      ADD COLUMN serial_number TEXT
    `);
  }
}

/*
========================================
LABEL NUMBER
========================================
*/

function createLabelNumber(type) {
  const prefix =
    type === "controller"
      ? "C"
      : "D";

  while (true) {
    const randomNumber =
      Math.floor(
        100000 +
        Math.random() * 900000
      );

    const number =
      `${prefix}-${randomNumber}`;

    const deviceExists =
      db
        .prepare(`
          SELECT id
          FROM devices
          WHERE label_number = ?
        `)
        .get(number);

    const controllerExists =
      db
        .prepare(`
          SELECT id
          FROM controllers
          WHERE label_number = ?
        `)
        .get(number);

    if (
      !deviceExists &&
      !controllerExists
    ) {
      return number;
    }
  }
}

/*
========================================
GENERATE OLD LABELS
========================================
*/

function backfillLabels() {
  const oldDevices = db
    .prepare(`
      SELECT id
      FROM devices
      WHERE label_number IS NULL
         OR label_number = ''
    `)
    .all();

  const updateDeviceLabel =
    db.prepare(`
      UPDATE devices
      SET label_number = ?
      WHERE id = ?
    `);

  for (const device of oldDevices) {
    updateDeviceLabel.run(
      createLabelNumber("device"),
      device.id
    );
  }

  const oldControllers = db
    .prepare(`
      SELECT id
      FROM controllers
      WHERE label_number IS NULL
         OR label_number = ''
    `)
    .all();

  const updateControllerLabel =
    db.prepare(`
      UPDATE controllers
      SET label_number = ?
      WHERE id = ?
    `);

  for (const controller of oldControllers) {
    updateControllerLabel.run(
      createLabelNumber("controller"),
      controller.id
    );
  }
}

// Run once immediately against the bootstrap copy of the database (mostly
// a no-op — the real schema check happens after every hydrate below).
ensureSchema();

/*
========================================
MOVEMENT
========================================
*/

function recordMovement({
  record_type,
  record_id,
  customer_id,
  action,
  status,
  notes,
}) {
  db.prepare(`
    INSERT INTO movements
    (
      record_type,
      record_id,
      customer_id,
      action,
      status,
      notes
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    record_type,
    record_id,
    customer_id || null,
    action,
    status || "",
    notes || ""
  );
}

function getMovementAction(
  oldStatus,
  newStatus
) {
  if (newStatus === "تم التسليم") {
    return "تسليم";
  }

  if (oldStatus !== newStatus) {
    return `تغيير الحالة إلى ${newStatus}`;
  }

  return "تحديث البيانات";
}

/*
========================================
VERCEL / NEON PERSISTENCE
========================================
Why this changed:

The old version loaded the database from Postgres ONCE when a serverless
instance started (cold start), then kept using its own private local copy
after that. Vercel can and does run several instances at the same time
(and spins up new ones constantly), so instance A registering a device
was invisible to instance B until B happened to cold-start again — that
was bug #1 (one device not seeing what another device did).

Worse, every write did "dump my whole local copy back over the remote
one", with no coordination between instances. If two people saved
something around the same time, whichever instance finished last would
silently overwrite the other's change, sometimes wiping out records that
were only ever saved to the "loser" instance — that was bug #2 (devices
getting mixed up / deleted when adding several in a row).

Fix:
1. Every GET request re-loads the latest copy from Postgres first, so
   reads are always fresh across every device (fixes #1).
2. Every write (POST/PUT/PATCH/DELETE) runs inside a real Postgres
   transaction that takes a row lock ("SELECT ... FOR UPDATE") for the
   whole request: lock -> load latest -> run the request's normal
   handler -> save -> unlock. If two writes happen at the same time,
   Postgres simply makes the second one wait until the first is fully
   saved, then it loads that up-to-date copy before making its own
   change. No more last-write-wins data loss (fixes #2).
*/

function loadDbFromBase64(base64Data) {
  const tmpPath = `${dbPath}.remote`;
  fs.writeFileSync(tmpPath, Buffer.from(base64Data, "base64"));
  db.close();
  fs.renameSync(tmpPath, dbPath);
  db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  ensureSchema();
}

function dumpDbToBase64() {
  return fs.readFileSync(dbPath).toString("base64");
}

// Simple unlocked refresh, used for read-only (GET) requests: just fetch
// whatever is newest so every device shows current data.
async function hydrateLatest() {
  if (!process.env.DATABASE_URL) return;

  const sql = neon(process.env.DATABASE_URL);
  await sql`CREATE TABLE IF NOT EXISTS app_state (id integer primary key, db_data text NOT NULL)`;
  const rows = await sql`SELECT db_data FROM app_state WHERE id = 1 LIMIT 1`;

  if (rows.length && rows[0].db_data) {
    loadDbFromBase64(rows[0].db_data);
  } else {
    const data = dumpDbToBase64();
    await sql`
      INSERT INTO app_state (id, db_data) VALUES (1, ${data})
      ON CONFLICT (id) DO UPDATE SET db_data = EXCLUDED.db_data
    `;
  }
}

// A single, reused connection pool for the locked read-modify-write cycle
// below. This needs a real session (not the one-shot HTTP `neon()` helper)
// so the lock can be held for the duration of one request.
let pool;
function getPool() {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

// Runs the rest of the request (next()) while holding a Postgres row lock,
// so concurrent writes from different devices/instances are serialized
// instead of racing each other.
async function withWriteLock(req, res, next) {
  if (!process.env.DATABASE_URL) return next();

  let client;
  try {
    client = await getPool().connect();
  } catch (error) {
    console.error("Database connection error:", error);
    return res.status(500).json({ message: "تعذر الاتصال بقاعدة البيانات" });
  }

  let settled = false;

  const finish = async (shouldSave) => {
    if (settled) return;
    settled = true;
    try {
      if (shouldSave) {
        const data = dumpDbToBase64();
        await client.query(
          `INSERT INTO app_state (id, db_data) VALUES (1, $1)
           ON CONFLICT (id) DO UPDATE SET db_data = EXCLUDED.db_data`,
          [data]
        );
        await client.query("COMMIT");
      } else {
        await client.query("ROLLBACK");
      }
    } catch (error) {
      console.error("Database save error:", error);
    } finally {
      client.release();
    }
  };

  try {
    await client.query("BEGIN");
    await client.query(
      `CREATE TABLE IF NOT EXISTS app_state (id integer primary key, db_data text NOT NULL)`
    );
    const { rows } = await client.query(
      "SELECT db_data FROM app_state WHERE id = 1 FOR UPDATE"
    );
    if (rows.length && rows[0].db_data) {
      loadDbFromBase64(rows[0].db_data);
    }
  } catch (error) {
    console.error("Database hydrate error:", error);
    await finish(false);
    if (!res.headersSent) {
      res.status(500).json({ message: "تعذر تشغيل قاعدة البيانات" });
    }
    return;
  }

  // Make sure we always release the lock, even if the handler throws,
  // forgets to call res.json, or the connection drops.
  res.on("close", () => finish(res.statusCode < 400));

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    finish(res.statusCode < 400).finally(() => originalJson(body));
    return res;
  };

  next();
}

app.use((req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    withWriteLock(req, res, next).catch((error) => {
      console.error("Write-lock error:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "تعذر تشغيل قاعدة البيانات" });
      }
    });
  } else {
    hydrateLatest()
      .then(next)
      .catch((error) => {
        console.error("Database initialization error:", error);
        res.status(500).json({ message: "تعذر تشغيل قاعدة البيانات" });
      });
  }
});

/*
========================================
MAIN
========================================
*/

app.get("/", (req, res) => {
  res.json({
    message:
      "ABU AL-KHAIR GAMING SHOP API is running",
    database:
      dbPath,
  });
});

/*
========================================
ACCOUNT / LOGIN SETTINGS
========================================
Username, password, and shop name used to live only in the browser's
localStorage. That meant they were per-device and per-browser: changing
the password on one tablet never affected another, and clearing site
data (private/incognito mode, "clear browsing data", a browser update,
etc.) silently reset everything back to admin / 1234 on that device.
They're now stored as rows in the same database as everything else, so
they persist properly and stay in sync across every device (bug #5).
*/

function getSetting(key, fallback) {
  const row = db
    .prepare(`SELECT value FROM app_settings WHERE key = ?`)
    .get(key);
  return row ? row.value : fallback;
}

function setSetting(key, value) {
  db.prepare(`
    INSERT INTO app_settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value);
}

app.get("/api/settings", (req, res) => {
  try {
    res.json({
      username: getSetting("admin_username", "admin"),
      shopName: getSetting("shop_name", "ABU AL-KHAIR GAMING SHOP"),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/settings/login", (req, res) => {
  try {
    const { username, password } = req.body || {};

    const savedUsername = getSetting("admin_username", "admin");
    const savedPassword = getSetting("admin_password", "1234");

    if (
      (username || "").trim() === savedUsername &&
      password === savedPassword
    ) {
      return res.json({ ok: true });
    }

    return res
      .status(401)
      .json({ ok: false, message: "اسم المستخدم أو كلمة المرور غير صحيحة" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/settings/account", (req, res) => {
  try {
    const {
      currentPassword,
      newUsername,
      newPassword,
    } = req.body || {};

    const savedPassword = getSetting("admin_password", "1234");

    if (!newUsername || !newUsername.trim()) {
      return res.status(400).json({ message: "اسم المستخدم مطلوب" });
    }

    if (!currentPassword || currentPassword !== savedPassword) {
      return res.status(401).json({ message: "كلمة السر الحالية غير صحيحة" });
    }

    if (!newPassword || newPassword.length < 4) {
      return res
        .status(400)
        .json({ message: "كلمة السر يجب أن تكون 4 أحرف أو أرقام على الأقل" });
    }

    setSetting("admin_username", newUsername.trim());
    setSetting("admin_password", newPassword);

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/settings/shop", (req, res) => {
  try {
    const { shopName } = req.body || {};

    if (!shopName || !shopName.trim()) {
      return res.status(400).json({ message: "اسم المحل مطلوب" });
    }

    setSetting("shop_name", shopName.trim());

    res.json({ ok: true, shopName: shopName.trim() });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/settings/reset", (req, res) => {
  try {
    setSetting("admin_username", "admin");
    setSetting("admin_password", "1234");
    setSetting("shop_name", "ABU AL-KHAIR GAMING SHOP");

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/*
========================================
CUSTOMERS
========================================
*/

app.get("/api/customers", (req, res) => {
  try {
    const customers = db
      .prepare(`
        SELECT *
        FROM customers
        ORDER BY id DESC
      `)
      .all();

    res.json(customers);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message:
        "حدث خطأ أثناء تحميل العملاء",
    });
  }
});


/*
========================================
CUSTOMER LOOKUP
========================================
*/

function normalizeCustomerValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[\s\-–—()]/g, "");
}

app.get("/api/customers/lookup", (req, res) => {
  try {
    const query = normalizeCustomerValue(req.query.q);
    if (!query) return res.json({ customer: null, matches: [] });

    const customers = db.prepare(`
      SELECT * FROM customers ORDER BY id DESC
    `).all();

    const matches = customers.filter((customer) => {
      const name = normalizeCustomerValue(customer.name);
      const phone = normalizeCustomerValue(customer.phone);
      const combined = normalizeCustomerValue(`${customer.name}-${customer.phone}`);
      return (
        name === query ||
        phone === query ||
        combined === query ||
        name.includes(query) ||
        phone.includes(query) ||
        combined.includes(query)
      );
    });

    const exact = matches.filter((customer) => {
      const name = normalizeCustomerValue(customer.name);
      const phone = normalizeCustomerValue(customer.phone);
      const combined = normalizeCustomerValue(`${customer.name}-${customer.phone}`);
      return name === query || phone === query || combined === query;
    });

    res.json({
      customer: exact.length === 1 ? exact[0] : (matches.length === 1 ? matches[0] : null),
      matches,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "حدث خطأ أثناء البحث عن العميل" });
  }
});

app.post("/api/customers", (req, res) => {
  try {
    const {
      name,
      phone,
      notes,
    } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        message:
          "اسم العميل ورقم الهاتف مطلوبان",
      });
    }

    const result = db
      .prepare(`
        INSERT INTO customers
        (name, phone, notes)
        VALUES (?, ?, ?)
      `)
      .run(
        name.trim(),
        phone.trim(),
        notes || ""
      );

    const customer = db
      .prepare(`
        SELECT *
        FROM customers
        WHERE id = ?
      `)
      .get(result.lastInsertRowid);

    res.status(201).json(customer);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message:
        "حدث خطأ أثناء إضافة العميل",
    });
  }
});

app.put("/api/customers/:id", (req, res) => {
  try {
    const id = Number(req.params.id);

    const {
      name,
      phone,
      notes,
    } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        message:
          "اسم العميل ورقم الهاتف مطلوبان",
      });
    }

    const existing = db
      .prepare(`
        SELECT *
        FROM customers
        WHERE id = ?
      `)
      .get(id);

    if (!existing) {
      return res.status(404).json({
        message:
          "العميل غير موجود",
      });
    }

    db.prepare(`
      UPDATE customers
      SET
        name = ?,
        phone = ?,
        notes = ?
      WHERE id = ?
    `).run(
      name.trim(),
      phone.trim(),
      notes || "",
      id
    );

    const customer = db
      .prepare(`
        SELECT *
        FROM customers
        WHERE id = ?
      `)
      .get(id);

    res.json(customer);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message:
        "حدث خطأ أثناء تعديل العميل",
    });
  }
});

app.delete("/api/customers/:id", (req, res) => {
  try {
    const id = Number(req.params.id);

    const customer = db
      .prepare(`
        SELECT *
        FROM customers
        WHERE id = ?
      `)
      .get(id);

    if (!customer) {
      return res.status(404).json({
        message:
          "العميل غير موجود",
      });
    }

    const devicesCount =
      db
        .prepare(`
          SELECT COUNT(*) AS count
          FROM devices
          WHERE customer_id = ?
        `)
        .get(id).count;

    const controllersCount =
      db
        .prepare(`
          SELECT COUNT(*) AS count
          FROM controllers
          WHERE customer_id = ?
        `)
        .get(id).count;

    if (
      devicesCount > 0 ||
      controllersCount > 0
    ) {
      return res.status(400).json({
        message:
          "لا يمكن حذف العميل لأنه مرتبط بأجهزة أو دراعات مسجلة. احذف السجلات المرتبطة أولاً.",
      });
    }

    db.prepare(`
      DELETE FROM customers
      WHERE id = ?
    `).run(id);

    res.json({
      message:
        "تم حذف العميل بنجاح",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message:
        "حدث خطأ أثناء حذف العميل",
    });
  }
});

/*
========================================
DEVICES
========================================
*/

app.get("/api/devices", (req, res) => {
  try {
    const search =
      req.query.search
        ? req.query.search.trim()
        : "";

    let devices;

    if (search) {
      devices = db
        .prepare(`
          SELECT
            devices.*,
            customers.name AS customer_name,
            customers.phone AS customer_phone
          FROM devices
          LEFT JOIN customers
            ON devices.customer_id = customers.id
          WHERE
            customers.name LIKE ?
            OR customers.phone LIKE ?
            OR devices.label_number LIKE ?
            OR devices.serial_number LIKE ?
            OR devices.model LIKE ?
          ORDER BY devices.id DESC
        `)
        .all(
          `%${search}%`,
          `%${search}%`,
          `%${search}%`,
          `%${search}%`,
          `%${search}%`
        );
    } else {
      devices = db
        .prepare(`
          SELECT
            devices.*,
            customers.name AS customer_name,
            customers.phone AS customer_phone
          FROM devices
          LEFT JOIN customers
            ON devices.customer_id = customers.id
          ORDER BY devices.id DESC
        `)
        .all();
    }

    res.json(devices);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message:
        "حدث خطأ أثناء تحميل الأجهزة",
    });
  }
});

app.post("/api/devices", (req, res) => {
  try {
    let {
      customer_id,
      customer_name,
      customer_phone,
      device_type,
      model,
      serial_number,
      status,
      notes,
    } = req.body;

    if (!device_type || (!customer_id && !customer_name && !customer_phone)) {
      return res.status(400).json({
        message:
          "العميل ونوع الجهاز مطلوبان",
      });
    }

    let customer = db
      .prepare(`
        SELECT *
        FROM customers
        WHERE id = ?
      `)
      .get(customer_id);

    // Recover gracefully from a stale browser/customer id by resolving
    // the customer from the submitted name/phone as well.
    if (!customer || customer_name || customer_phone) {
      const normalize = (value) => String(value || "").trim().toLowerCase().normalize("NFKC").replace(/[\s\-–—()_.+]/g, "");
      const submittedName = normalize(customer_name);
      const submittedPhone = normalize(customer_phone);
      const candidates = db.prepare(`SELECT * FROM customers ORDER BY id DESC`).all();
      const byName = submittedName ? candidates.find((item) => normalize(item.name) === submittedName) : null;
      const byPhone = submittedPhone ? candidates.find((item) => normalize(item.phone) === submittedPhone) : null;
      customer = byName || byPhone || customer;
    }

    if (!customer) {
      return res.status(404).json({
        message:
          "العميل غير موجود. تأكد من بيانات العميل.",
      });
    }

    // Always use the resolved server-side id.
    customer_id = customer.id;

    const finalStatus =
      status || "داخل المحل";

    const labelNumber =
      createLabelNumber("device");

    const result = db
      .prepare(`
        INSERT INTO devices
        (
          customer_id,
          device_type,
          model,
          serial_number,
          status,
          notes,
          label_number
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        customer_id,
        device_type,
        model || "",
        serial_number || "",
        finalStatus,
        notes || "",
        labelNumber
      );

    const deviceId =
      result.lastInsertRowid;

    recordMovement({
      record_type: "device",
      record_id: deviceId,
      customer_id,
      action: "استلام",
      status: finalStatus,
      notes:
        notes ||
        "تم تسجيل الجهاز واستلامه",
    });

    if (finalStatus === "تم التسليم") {
      db.prepare(`
        UPDATE devices
        SET delivered_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(deviceId);
    }

    const device = db
      .prepare(`
        SELECT
          devices.*,
          customers.name AS customer_name,
          customers.phone AS customer_phone
        FROM devices
        LEFT JOIN customers
          ON devices.customer_id = customers.id
        WHERE devices.id = ?
      `)
      .get(deviceId);

    res.status(201).json(device);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message:
        "حدث خطأ أثناء إضافة الجهاز",
    });
  }
});

app.put("/api/devices/:id", (req, res) => {
  try {
    const id = Number(req.params.id);

    let {
      customer_id,
      customer_name,
      customer_phone,
      device_type,
      model,
      serial_number,
      status,
      notes,
    } = req.body;

    if (!device_type || (!customer_id && !customer_name && !customer_phone)) {
      return res.status(400).json({
        message:
          "العميل ونوع الجهاز مطلوبان",
      });
    }

    const device = db
      .prepare(`
        SELECT *
        FROM devices
        WHERE id = ?
      `)
      .get(id);

    if (!device) {
      return res.status(404).json({
        message:
          "الجهاز غير موجود",
      });
    }

    let customer = db
      .prepare(`
        SELECT *
        FROM customers
        WHERE id = ?
      `)
      .get(customer_id);

    // Recover gracefully from a stale browser/customer id by resolving
    // the customer from the submitted name/phone as well.
    if (!customer || customer_name || customer_phone) {
      const normalize = (value) => String(value || "").trim().toLowerCase().normalize("NFKC").replace(/[\s\-–—()_.+]/g, "");
      const submittedName = normalize(customer_name);
      const submittedPhone = normalize(customer_phone);
      const candidates = db.prepare(`SELECT * FROM customers ORDER BY id DESC`).all();
      const byName = submittedName ? candidates.find((item) => normalize(item.name) === submittedName) : null;
      const byPhone = submittedPhone ? candidates.find((item) => normalize(item.phone) === submittedPhone) : null;
      customer = byName || byPhone || customer;
    }

    if (!customer) {
      return res.status(404).json({
        message:
          "العميل غير موجود. تأكد من بيانات العميل.",
      });
    }

    // Always use the resolved server-side id.
    customer_id = customer.id;

    const finalStatus =
      status || "داخل المحل";

    db.prepare(`
      UPDATE devices
      SET
        customer_id = ?,
        device_type = ?,
        model = ?,
        serial_number = ?,
        status = ?,
        notes = ?,
        delivered_at = CASE
          WHEN ? = 'تم التسليم'
            THEN COALESCE(
              delivered_at,
              CURRENT_TIMESTAMP
            )
          ELSE NULL
        END
      WHERE id = ?
    `).run(
      customer_id,
      device_type,
      model || "",
      serial_number || "",
      finalStatus,
      notes || "",
      finalStatus,
      id
    );

    const action =
      getMovementAction(
        device.status,
        finalStatus
      );

    recordMovement({
      record_type: "device",
      record_id: id,
      customer_id,
      action,
      status: finalStatus,
      notes: notes || "",
    });

    const updated = db
      .prepare(`
        SELECT
          devices.*,
          customers.name AS customer_name,
          customers.phone AS customer_phone
        FROM devices
        LEFT JOIN customers
          ON devices.customer_id = customers.id
        WHERE devices.id = ?
      `)
      .get(id);

    res.json(updated);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message:
        "حدث خطأ أثناء تعديل الجهاز",
    });
  }
});

app.delete("/api/devices/:id", (req, res) => {
  try {
    const id = Number(req.params.id);

    const device = db
      .prepare(`
        SELECT *
        FROM devices
        WHERE id = ?
      `)
      .get(id);

    if (!device) {
      return res.status(404).json({
        message:
          "الجهاز غير موجود",
      });
    }

    db.prepare(`
      DELETE FROM devices
      WHERE id = ?
    `).run(id);

    res.json({
      message:
        "تم حذف الجهاز بنجاح",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message:
        "حدث خطأ أثناء حذف الجهاز",
    });
  }
});

/*
========================================
LABEL SEARCH
========================================
*/

app.get(
  "/api/labels/:labelNumber",
  (req, res) => {
    try {
      const labelNumber =
        req.params.labelNumber.trim();

      const device = db
        .prepare(`
          SELECT
            devices.*,
            customers.name AS customer_name,
            customers.phone AS customer_phone,
            'Device' AS record_type
          FROM devices
          LEFT JOIN customers
            ON devices.customer_id = customers.id
          WHERE devices.label_number = ?
        `)
        .get(labelNumber);

      if (device) {
        return res.json(device);
      }

      const controller = db
        .prepare(`
          SELECT
            controllers.*,
            customers.name AS customer_name,
            customers.phone AS customer_phone,
            'Controller' AS record_type
          FROM controllers
          LEFT JOIN customers
            ON controllers.customer_id = customers.id
          WHERE controllers.label_number = ?
        `)
        .get(labelNumber);

      if (controller) {
        return res.json(controller);
      }

      res.status(404).json({
        message:
          "رقم الليبل غير موجود",
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "حدث خطأ أثناء البحث بالليبل",
      });
    }
  }
);

/*
========================================
CONTROLLERS
========================================
*/

app.get("/api/controllers", (req, res) => {
  try {
    const controllers = db
      .prepare(`
        SELECT
          controllers.*,
          customers.name AS customer_name,
          customers.phone AS customer_phone
        FROM controllers
        LEFT JOIN customers
          ON controllers.customer_id = customers.id
        ORDER BY controllers.id DESC
      `)
      .all();

    res.json(controllers);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message:
        "حدث خطأ أثناء تحميل الدراعات",
    });
  }
});

app.post("/api/controllers", (req, res) => {
  try {
    const {
      customer_id,
      controller_type,
      quantity,
      condition,
      repair_cost,
      status,
      notes,
    } = req.body;

    if (
      !customer_id ||
      !controller_type
    ) {
      return res.status(400).json({
        message:
          "العميل ونوع الدراع مطلوبان",
      });
    }

    const customer = db
      .prepare(`
        SELECT *
        FROM customers
        WHERE id = ?
      `)
      .get(customer_id);

    if (!customer) {
      return res.status(404).json({
        message:
          "العميل غير موجود",
      });
    }

    const controllerQuantity =
      Number(quantity) > 0
        ? Number(quantity)
        : 1;

    const controllerCondition =
      condition === "Copy"
        ? "Copy"
        : "Original";

    const controllerRepairCost =
      Number(repair_cost) >= 0
        ? Number(repair_cost)
        : 0;

    const finalStatus =
      status || "داخل المحل";

    const labelNumber =
      createLabelNumber("controller");

    const result = db
      .prepare(`
        INSERT INTO controllers
        (
          customer_id,
          controller_type,
          model,
          quantity,
          condition,
          repair_cost,
          status,
          notes,
          label_number
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        customer_id,
        controller_type,
        "",
        controllerQuantity,
        controllerCondition,
        controllerRepairCost,
        finalStatus,
        notes || "",
        labelNumber
      );

    const controllerId =
      result.lastInsertRowid;

    recordMovement({
      record_type: "controller",
      record_id: controllerId,
      customer_id,
      action: "استلام",
      status: finalStatus,
      notes:
        notes ||
        "تم تسجيل الدراع واستلامه",
    });

    if (finalStatus === "تم التسليم") {
      db.prepare(`
        UPDATE controllers
        SET delivered_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(controllerId);
    }

    const controller = db
      .prepare(`
        SELECT
          controllers.*,
          customers.name AS customer_name,
          customers.phone AS customer_phone
        FROM controllers
        LEFT JOIN customers
          ON controllers.customer_id = customers.id
        WHERE controllers.id = ?
      `)
      .get(controllerId);

    res.status(201).json(controller);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message:
        "حدث خطأ أثناء إضافة الدراع",
    });
  }
});

app.put(
  "/api/controllers/:id",
  (req, res) => {
    try {
      const id = Number(req.params.id);

      const {
        customer_id,
        controller_type,
        quantity,
        condition,
        repair_cost,
        status,
        notes,
      } = req.body;

      if (
        !customer_id ||
        !controller_type
      ) {
        return res.status(400).json({
          message:
            "العميل ونوع الدراع مطلوبان",
        });
      }

      const controller = db
        .prepare(`
          SELECT *
          FROM controllers
          WHERE id = ?
        `)
        .get(id);

      if (!controller) {
        return res.status(404).json({
          message:
            "الدراع غير موجود",
        });
      }

      const customer = db
        .prepare(`
          SELECT *
          FROM customers
          WHERE id = ?
        `)
        .get(customer_id);

      if (!customer) {
        return res.status(404).json({
          message:
            "العميل غير موجود",
        });
      }

      const controllerQuantity =
        Number(quantity) > 0
          ? Number(quantity)
          : 1;

      const controllerCondition =
        condition === "Copy"
          ? "Copy"
          : "Original";

      const controllerRepairCost =
        Number(repair_cost) >= 0
          ? Number(repair_cost)
          : 0;

      const finalStatus =
        status || "داخل المحل";

      db.prepare(`
        UPDATE controllers
        SET
          customer_id = ?,
          controller_type = ?,
          model = '',
          quantity = ?,
          condition = ?,
          repair_cost = ?,
          status = ?,
          notes = ?,
          delivered_at = CASE
            WHEN ? = 'تم التسليم'
              THEN COALESCE(
                delivered_at,
                CURRENT_TIMESTAMP
              )
            ELSE NULL
          END
        WHERE id = ?
      `).run(
        customer_id,
        controller_type,
        controllerQuantity,
        controllerCondition,
        controllerRepairCost,
        finalStatus,
        notes || "",
        finalStatus,
        id
      );

      const action =
        getMovementAction(
          controller.status,
          finalStatus
        );

      recordMovement({
        record_type: "controller",
        record_id: id,
        customer_id,
        action,
        status: finalStatus,
        notes: notes || "",
      });

      const updated = db
        .prepare(`
          SELECT
            controllers.*,
            customers.name AS customer_name,
            customers.phone AS customer_phone
          FROM controllers
          LEFT JOIN customers
            ON controllers.customer_id = customers.id
          WHERE controllers.id = ?
        `)
        .get(id);

      res.json(updated);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "حدث خطأ أثناء تعديل الدراع",
      });
    }
  }
);

app.delete(
  "/api/controllers/:id",
  (req, res) => {
    try {
      const id = Number(req.params.id);

      const controller = db
        .prepare(`
          SELECT *
          FROM controllers
          WHERE id = ?
        `)
        .get(id);

      if (!controller) {
        return res.status(404).json({
          message:
            "الدراع غير موجود",
        });
      }

      db.prepare(`
        DELETE FROM controllers
        WHERE id = ?
      `).run(id);

      res.json({
        message:
          "تم حذف الدراع بنجاح",
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "حدث خطأ أثناء حذف الدراع",
      });
    }
  }
);

/*
========================================
MOVEMENT HISTORY
========================================
*/

app.get("/api/movements", (req, res) => {
  try {
    const {
      record_type,
      record_id,
    } = req.query;

    let movements;

    if (
      record_type &&
      record_id
    ) {
      movements = db
        .prepare(`
          SELECT
            movements.*,
            customers.name AS customer_name,
            customers.phone AS customer_phone
          FROM movements
          LEFT JOIN customers
            ON movements.customer_id = customers.id
          WHERE movements.record_type = ?
            AND movements.record_id = ?
          ORDER BY movements.id DESC
        `)
        .all(
          record_type,
          Number(record_id)
        );
    } else {
      movements = db
        .prepare(`
          SELECT
            movements.*,
            customers.name AS customer_name,
            customers.phone AS customer_phone
          FROM movements
          LEFT JOIN customers
            ON movements.customer_id = customers.id
          ORDER BY movements.id DESC
        `)
        .all();
    }

    res.json(movements);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message:
        "حدث خطأ أثناء تحميل سجل الحركات",
    });
  }
});

app.post("/api/movements", (req, res) => {
  try {
    const {
      record_type,
      record_id,
      customer_id,
      action,
      status,
      notes,
    } = req.body;

    if (
      !record_type ||
      !record_id ||
      !action
    ) {
      return res.status(400).json({
        message:
          "نوع السجل ورقم السجل ونوع الحركة مطلوبين",
      });
    }

    if (
      record_type !== "device" &&
      record_type !== "controller"
    ) {
      return res.status(400).json({
        message:
          "نوع السجل غير صحيح",
      });
    }

    recordMovement({
      record_type,
      record_id: Number(record_id),
      customer_id: customer_id || null,
      action,
      status: status || "",
      notes: notes || "",
    });

    const movement = db
      .prepare(`
        SELECT
          movements.*,
          customers.name AS customer_name,
          customers.phone AS customer_phone
        FROM movements
        LEFT JOIN customers
          ON movements.customer_id = customers.id
        WHERE movements.id =
          last_insert_rowid()
      `)
      .get();

    res.status(201).json(movement);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message:
        "حدث خطأ أثناء تسجيل الحركة",
    });
  }
});

/*
========================================
PRODUCTS
========================================
*/

app.get("/api/products", (req, res) => {
  try {
    const products = db
      .prepare(`
        SELECT *
        FROM products
        ORDER BY id DESC
      `)
      .all();

    res.json(products);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message:
        "حدث خطأ أثناء تحميل المنتجات",
    });
  }
});

app.post("/api/products", (req, res) => {
  try {
    const {
      name,
      category,
      serial_number,
      purchase_price,
      sale_price,
      warranty_months,
    } = req.body;

    if (!name || !category) {
      return res.status(400).json({
        message:
          "اسم المنتج والقسم مطلوبان",
      });
    }

    const result = db
      .prepare(`
        INSERT INTO products
        (
          name,
          category,
          serial_number,
          purchase_price,
          sale_price,
          warranty_months
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(
        name.trim(),
        category.trim(),
        serial_number || "",
        Number(purchase_price) || 0,
        Number(sale_price) || 0,
        Number(warranty_months) || 0
      );

    const product = db
      .prepare(`
        SELECT *
        FROM products
        WHERE id = ?
      `)
      .get(result.lastInsertRowid);

    res.status(201).json(product);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message:
        "حدث خطأ أثناء إضافة المنتج",
    });
  }
});

/*
========================================
INVOICES
========================================
*/

app.get("/api/invoices", (req, res) => {
  try {
    const invoices = db
      .prepare(`
        SELECT
          sales.id,
          sales.invoice_number AS invoiceNumber,
          customers.name AS customerName,
          customers.phone AS customerPhone,
          sale_items.product_name AS deviceName,
          sale_items.serial_number AS serialNumber,
          sale_items.quantity AS quantity,
          sale_items.price AS price,
          sales.total AS total,
          sale_items.warranty_months AS warrantyMonths,
          sale_items.warranty_end AS warrantyEnd,
          DATE(sales.sale_date) AS purchaseDate,
          sales.sale_date AS invoiceDate
        FROM sales
        LEFT JOIN customers
          ON sales.customer_id = customers.id
        LEFT JOIN sale_items
          ON sales.id = sale_items.sale_id
        ORDER BY sales.id DESC
      `)
      .all();

    res.json(invoices);
  } catch (error) {
    console.error(
      "Get invoices error:",
      error
    );

    res.status(500).json({
      message:
        "حدث خطأ أثناء تحميل الفواتير",
    });
  }
});

/*
========================================
ADD INVOICE
========================================
*/

app.post("/api/invoices", (req, res) => {
  try {
    const {
      customerName,
      customerPhone,
      deviceName,
      serialNumber,
      price,
      purchaseDate,
      warrantyMonths,
      warrantyEnd,
    } = req.body;

    if (
      !customerName ||
      !customerPhone ||
      !deviceName ||
      !serialNumber ||
      price === undefined ||
      price === null ||
      price === ""
    ) {
      return res.status(400).json({
        message:
          "من فضلك أكمل بيانات الفاتورة",
      });
    }

    const transaction =
      db.transaction(() => {

        let customer = db
          .prepare(`
            SELECT *
            FROM customers
            WHERE phone = ?
            LIMIT 1
          `)
          .get(
            customerPhone.trim()
          );

        if (!customer) {
          const customerResult =
            db
              .prepare(`
                INSERT INTO customers
                (
                  name,
                  phone,
                  notes
                )
                VALUES (?, ?, ?)
              `)
              .run(
                customerName.trim(),
                customerPhone.trim(),
                "تم إنشاء العميل من فاتورة بيع"
              );

          customer = db
            .prepare(`
              SELECT *
              FROM customers
              WHERE id = ?
            `)
            .get(
              customerResult.lastInsertRowid
            );
        }

        const invoiceNumber =
          `INV-${Date.now()}`;

        const saleResult =
          db
            .prepare(`
              INSERT INTO sales
              (
                invoice_number,
                customer_id,
                total,
                payment_method,
                sale_date
              )
              VALUES (?, ?, ?, ?, ?)
            `)
            .run(
              invoiceNumber,
              customer.id,
              Number(price),
              "نقدي",
              purchaseDate
                ? `${purchaseDate}T00:00:00`
                : new Date().toISOString()
            );

        const saleId =
          saleResult.lastInsertRowid;

        db
          .prepare(`
            INSERT INTO sale_items
            (
              sale_id,
              product_id,
              product_name,
              serial_number,
              quantity,
              price,
              warranty_months,
              warranty_end
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .run(
            saleId,
            null,
            deviceName.trim(),
            serialNumber.trim(),
            1,
            Number(price),
            Number(warrantyMonths) || 0,
            warrantyEnd || null
          );

        return db
          .prepare(`
            SELECT
              sales.id,
              sales.invoice_number AS invoiceNumber,
              customers.name AS customerName,
              customers.phone AS customerPhone,
              sale_items.product_name AS deviceName,
              sale_items.serial_number AS serialNumber,
              sale_items.quantity AS quantity,
              sale_items.price AS price,
              sales.total AS total,
              sale_items.warranty_months AS warrantyMonths,
              sale_items.warranty_end AS warrantyEnd,
              DATE(sales.sale_date) AS purchaseDate,
              sales.sale_date AS invoiceDate
            FROM sales
            LEFT JOIN customers
              ON sales.customer_id = customers.id
            LEFT JOIN sale_items
              ON sales.id = sale_items.sale_id
            WHERE sales.id = ?
          `)
          .get(saleId);
      });

    const invoice =
      transaction();

    res.status(201).json(invoice);

  } catch (error) {
    console.error(
      "Save invoice error:",
      error
    );

    res.status(500).json({
      message:
        "حدث خطأ أثناء حفظ الفاتورة",
    });
  }
});

/*
========================================
SINGLE INVOICE
========================================
*/

app.get(
  "/api/invoices/:id",
  (req, res) => {
    try {
      const id =
        Number(req.params.id);

      const invoice =
        db
          .prepare(`
            SELECT
              sales.id,
              sales.invoice_number AS invoiceNumber,
              customers.name AS customerName,
              customers.phone AS customerPhone,
              sale_items.product_name AS deviceName,
              sale_items.serial_number AS serialNumber,
              sale_items.quantity AS quantity,
              sale_items.price AS price,
              sales.total AS total,
              sale_items.warranty_months AS warrantyMonths,
              sale_items.warranty_end AS warrantyEnd,
              DATE(sales.sale_date) AS purchaseDate,
              sales.sale_date AS invoiceDate
            FROM sales
            LEFT JOIN customers
              ON sales.customer_id = customers.id
            LEFT JOIN sale_items
              ON sales.id = sale_items.sale_id
            WHERE sales.id = ?
          `)
          .get(id);

      if (!invoice) {
        return res.status(404).json({
          message:
            "الفاتورة غير موجودة",
        });
      }

      res.json(invoice);

    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "حدث خطأ أثناء تحميل الفاتورة",
      });
    }
  }
);

/*
========================================
DELETE INVOICE
========================================
*/

app.delete(
  "/api/invoices/:id",
  (req, res) => {
    try {
      const id =
        Number(req.params.id);

      const invoice =
        db
          .prepare(`
            SELECT *
            FROM sales
            WHERE id = ?
          `)
          .get(id);

      if (!invoice) {
        return res.status(404).json({
          message:
            "الفاتورة غير موجودة",
        });
      }

      const transaction =
        db.transaction(() => {

          db.prepare(`
            DELETE FROM sale_items
            WHERE sale_id = ?
          `).run(id);

          db.prepare(`
            DELETE FROM sales
            WHERE id = ?
          `).run(id);
        });

      transaction();

      res.json({
        message:
          "تم حذف الفاتورة بنجاح",
      });

    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "حدث خطأ أثناء حذف الفاتورة",
      });
    }
  }
);

/*
========================================
WARRANTY SEARCH
========================================
*/

app.get(
  "/api/warranty/:serialNumber",
  (req, res) => {
    try {
      const serialNumber =
        req.params.serialNumber.trim();

      const warranty =
        db
          .prepare(`
            SELECT
              sales.id,
              sales.invoice_number AS invoiceNumber,
              customers.name AS customerName,
              customers.phone AS customerPhone,
              sale_items.product_name AS deviceName,
              sale_items.serial_number AS serialNumber,
              sale_items.price AS price,
              DATE(sales.sale_date) AS purchaseDate,
              sale_items.warranty_months AS warrantyMonths,
              sale_items.warranty_end AS warrantyEnd
            FROM sale_items
            INNER JOIN sales
              ON sale_items.sale_id = sales.id
            LEFT JOIN customers
              ON sales.customer_id = customers.id
            WHERE sale_items.serial_number = ?
            ORDER BY sales.id DESC
            LIMIT 1
          `)
          .get(serialNumber);

      if (!warranty) {
        return res.status(404).json({
          message:
            "لا يوجد جهاز بهذا السيريال",
        });
      }

      const today =
        new Date();

      today.setHours(
        0,
        0,
        0,
        0
      );

      const end =
        warranty.warrantyEnd
          ? new Date(
              warranty.warrantyEnd
            )
          : null;

      let warrantyStatus =
        "غير محدد";

      let daysLeft = null;

      if (end) {
        end.setHours(
          0,
          0,
          0,
          0
        );

        if (end < today) {
          warrantyStatus =
            "الضمان منتهي";

          daysLeft = 0;

        } else {

          const difference =
            end.getTime() -
            today.getTime();

          daysLeft =
            Math.ceil(
              difference /
              (1000 * 60 * 60 * 24)
            );

          if (daysLeft <= 30) {
            warrantyStatus =
              `ينتهي خلال ${daysLeft} يوم`;
          } else {
            warrantyStatus =
              "الضمان ساري";
          }
        }
      }

      res.json({
        ...warranty,
        warrantyStatus,
        daysLeft,
      });

    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "حدث خطأ أثناء البحث عن الضمان",
      });
    }
  }
);

module.exports = app;
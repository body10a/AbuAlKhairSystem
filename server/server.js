const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

/*
========================================
SERVE REACT BUILD (FRONTEND)
========================================
*/

// مجلد الفرونت إند بعد ما بتعمل npm run build جوه y/
// السيرفر بيسيرف الملفات دي مباشرة زي أي static file
const frontendDistPath = path.join(
  __dirname,
  "..",
  "y",
  "dist"
);

app.use(express.static(frontendDistPath));

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

const dbPath = path.join(
  __dirname,
  "..",
  "abuAlkhair.db"
);

console.log("Database:", dbPath);

const db = new Database(dbPath);

db.pragma("foreign_keys = ON");

/*
========================================
CREATE TABLES
========================================
*/

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
`);

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

/*
========================================
MIGRATIONS
========================================
*/

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
    const {
      customer_id,
      device_type,
      model,
      serial_number,
      status,
      notes,
    } = req.body;

    if (!customer_id || !device_type) {
      return res.status(400).json({
        message:
          "العميل ونوع الجهاز مطلوبان",
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

    const {
      customer_id,
      device_type,
      model,
      serial_number,
      status,
      notes,
    } = req.body;

    if (!customer_id || !device_type) {
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

/*
========================================
SPA FALLBACK
========================================
*/

// أي طلب مش API ومش ملف ثابت، رجّعله index.html
// عشان React Router (لو موجود) يقدر يتحكم في التنقل بين الصفحات
app.get(
  /^(?!\/api).*/,
  (req, res) => {
    res.sendFile(
      path.join(frontendDistPath, "index.html")
    );
  }
);

/*
========================================
SERVER
========================================
*/

app.listen(
  PORT,
  () => {
    console.log(
      `ABU AL-KHAIR SERVER running on http://localhost:${PORT}`
    );

    console.log(
      `Using database: ${dbPath}`
    );
  }
);
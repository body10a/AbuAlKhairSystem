const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

const app = express();

app.use(cors());
app.use(express.json());

// إنشاء سيرفر HTTP وربطه بـ Socket.IO للربط اللحظي بين الأجهزة
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

// إعداد قاعدة البيانات
const dbPath = path.join(__dirname, "ps_manager.db");
const db = new Database(dbPath);

// إنشاء الجداول
db.exec(`
  CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    hourly_rate REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'available',
    start_time TEXT,
    session_type TEXT,
    customer_id INTEGER,
    customer_name TEXT,
    controllers_count INTEGER DEFAULT 0,
    elapsed_time INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id INTEGER NOT NULL,
    device_name TEXT NOT NULL,
    customer_id INTEGER,
    customer_name TEXT,
    session_type TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    hourly_rate REAL NOT NULL,
    total_amount REAL NOT NULL,
    controllers_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// إدخال البيانات الافتراضية
const existingAdmin = db.prepare("SELECT value FROM app_settings WHERE key = ?").get("admin_password");
if (!existingAdmin) {
  const seedSetting = db.prepare(`INSERT INTO app_settings (key, value) VALUES (?, ?)`);
  seedSetting.run("admin_username", "admin");
  seedSetting.run("admin_password", "1234");
  seedSetting.run("shop_name", "ABU AL-KHAIR GAMING SHOP");
}

// دالة مساعدة لجلب الإعدادات
function getSetting(key, fallback) {
  const row = db.prepare(`SELECT value FROM app_settings WHERE key = ?`).get(key);
  return row ? row.value : fallback;
}

// دالة مساعدة لحفظ أو تحديث الإعدادات
function setSetting(key, value) {
  const stmt = db.prepare(`
    INSERT INTO app_settings (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);
  stmt.run(key, String(value));
}

// دالة للبث اللحظي لجميع الأجهزة المتصلة
function notifyClients() {
  io.emit("data_updated");
}

// --- Socket.IO Events ---
io.on("connection", (socket) => {
  console.log("جهاز جديد متصل:", socket.id);
  socket.on("disconnect", () => {
    console.log("تم فصل الجهاز:", socket.id);
  });
});

// --- API Routes ---

// 1. الأجهزة (Devices)
app.get("/api/devices", (req, res) => {
  const devices = db.prepare("SELECT * FROM devices ORDER BY id ASC").all();
  res.json(devices);
});

app.post("/api/devices", (req, res) => {
  const { name, type, hourly_rate } = req.body;
  const stmt = db.prepare(`
    INSERT INTO devices (name, type, hourly_rate, status)
    VALUES (?, ?, ?, 'available')
  `);
  const result = stmt.run(name, type, Number(hourly_rate));
  notifyClients();
  res.json({ id: result.lastInsertRowid, name, type, hourly_rate, status: "available" });
});

app.put("/api/devices/:id", (req, res) => {
  const { id } = req.params;
  const { name, type, hourly_rate, status, start_time, session_type, customer_id, customer_name, controllers_count, elapsed_time } = req.body;

  const stmt = db.prepare(`
    UPDATE devices
    SET name = ?, type = ?, hourly_rate = ?, status = ?, start_time = ?, session_type = ?, customer_id = ?, customer_name = ?, controllers_count = ?, elapsed_time = ?
    WHERE id = ?
  `);

  stmt.run(name, type, hourly_rate, status, start_time, session_type, customer_id, customer_name, controllers_count, elapsed_time, id);
  notifyClients();
  res.json({ success: true });
});

app.delete("/api/devices/:id", (req, res) => {
  const { id } = req.params;
  db.prepare("DELETE FROM devices WHERE id = ?").run(id);
  notifyClients();
  res.json({ success: true });
});

// 2. العملاء (Customers)
app.get("/api/customers", (req, res) => {
  const customers = db.prepare("SELECT * FROM customers ORDER BY id DESC").all();
  res.json(customers);
});

app.post("/api/customers", (req, res) => {
  const { name, phone, notes } = req.body;
  const stmt = db.prepare(`
    INSERT INTO customers (name, phone, notes)
    VALUES (?, ?, ?)
  `);
  const result = stmt.run(name, phone || "", notes || "");
  notifyClients();
  res.json({ id: result.lastInsertRowid, name, phone, notes });
});

app.delete("/api/customers/:id", (req, res) => {
  const { id } = req.params;
  db.prepare("DELETE FROM customers WHERE id = ?").run(id);
  notifyClients();
  res.json({ success: true });
});

// 3. الجلسات والتقارير (Sessions)
app.get("/api/sessions", (req, res) => {
  const sessions = db.prepare("SELECT * FROM sessions ORDER BY id DESC").all();
  res.json(sessions);
});

app.post("/api/sessions", (req, res) => {
  const { device_id, device_name, customer_id, customer_name, session_type, start_time, end_time, duration_minutes, hourly_rate, total_amount, controllers_count } = req.body;

  const stmt = db.prepare(`
    INSERT INTO sessions (device_id, device_name, customer_id, customer_name, session_type, start_time, end_time, duration_minutes, hourly_rate, total_amount, controllers_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(device_id, device_name, customer_id, customer_name, session_type, start_time, end_time, duration_minutes, hourly_rate, total_amount, controllers_count);
  notifyClients();
  res.json({ id: result.lastInsertRowid });
});

// 4. الإعدادات وتسجيل الدخول (Settings & Login)
app.get("/api/settings", (req, res) => {
  res.json({
    admin_username: getSetting("admin_username", "admin"),
    admin_password: getSetting("admin_password", "1234"),
    shop_name: getSetting("shop_name", "ABU AL-KHAIR GAMING SHOP")
  });
});

app.post("/api/settings/login", (req, res) => {
  const { username, password } = req.body;
  const currentUsername = getSetting("admin_username", "admin");
  const currentPassword = getSetting("admin_password", "1234");

  if (username === currentUsername && password === currentPassword) {
    return res.json({ ok: true, message: "تم تسجيل الدخول بنجاح" });
  }
  return res.status(401).json({ ok: false, message: "اسم المستخدم أو كلمة المرور غير صحيحة" });
});

app.post("/api/settings/account", (req, res) => {
  const { username, password } = req.body;
  if (username) setSetting("admin_username", username);
  if (password) setSetting("admin_password", password);
  notifyClients();
  res.json({ success: true });
});

app.post("/api/settings/shop", (req, res) => {
  const { shop_name } = req.body;
  if (shop_name) setSetting("shop_name", shop_name);
  notifyClients();
  res.json({ success: true });
});

// تشغيل السيرفر بواسطة HTTP ومزود بـ Socket.IO
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
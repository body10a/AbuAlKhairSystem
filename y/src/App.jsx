import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import Login from "./Login";
import Customers from "./pages/Customers";
import Devices from "./pages/Devices";
import Controllers from "./pages/Controllers";
import Invoices from "./pages/Invoices";
import Settings from "./pages/settings";
import "./App.css";

const API_URL = "http://localhost:3001";
const socket = io(API_URL);

async function readJsonResponse(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`الخادم لم يُرجع JSON صالحًا (${response.status})`);
  }
}

const translations = {
  ar: {
    welcome: "WELCOME BACK",
    welcomeTitle: "أهلاً بيك في سيستم المحل 👋",
    welcomeText: "إدارة العملاء والأجهزة والدراعات والفواتير والاستلام والتسليم من مكان واحد.",
    newDevice: "+ تسجيل جهاز جديد",
    customers: "العملاء",
    devices: "الأجهزة",
    controllers: "الدراعات",
    invoices: "الفواتير",
    totalCustomers: "إجمالي العملاء",
    totalDevices: "إجمالي الأجهزة",
    totalControllers: "إجمالي الدراعات",
    devicesInside: "أجهزة داخل المحل",
    management: "إدارة المحل",
    chooseSection: "اختار القسم اللي عايز تدخل عليه.",
    refresh: "تحديث الأرقام",
    home: "الرئيسية",
    settings: "الإعدادات",
    logout: "تسجيل الخروج",
    shopSystem: "نظام إدارة الأجهزة والعملاء",
    footer: "نظام إدارة الأجهزة © 2026",
  },
  en: {
    welcome: "WELCOME BACK",
    welcomeTitle: "Welcome to the shop system 👋",
    welcomeText: "Manage customers, devices, controllers, invoices, check-ins and deliveries from one place.",
    newDevice: "+ Register New Device",
    customers: "Customers",
    devices: "Devices",
    controllers: "Controllers",
    invoices: "Invoices",
    totalCustomers: "Total Customers",
    totalDevices: "Total Devices",
    totalControllers: "Total Controllers",
    devicesInside: "Devices Inside",
    management: "Shop Management",
    chooseSection: "Choose the section you want to enter.",
    refresh: "Refresh Numbers",
    home: "Home",
    settings: "Settings",
    logout: "Logout",
    shopSystem: "Device & Customer Management System",
    footer: "Device Management System © 2026",
  },
};

function Dashboard({ onLogout }) {
  const [activePage, setActivePage] = useState("dashboard");
  const [language, setLanguage] = useState(localStorage.getItem("app_language") || "ar");
  const [theme, setTheme] = useState(localStorage.getItem("app_theme") || "dark");
  const [shopName, setShopName] = useState("ABU AL-KHAIR GAMING SHOP");

  const [stats, setStats] = useState({
    customers: 0,
    devices: 0,
    controllers: 0,
    devicesInside: 0,
  });

  const [loadingStats, setLoadingStats] = useState(true);
  const t = translations[language] || translations.ar;

  /* =========================
      LANGUAGE & THEME
  ========================= */
  useEffect(() => {
    localStorage.setItem("app_language", language);
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);

  useEffect(() => {
    localStorage.setItem("app_theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  /* =========================
      SHOP NAME & REALTIME UPDATE
  ========================= */
  const fetchShopSettings = () => {
    fetch(`${API_URL}/api/settings`)
      .then((res) => res.json())
      .then((data) => {
        if (data.shop_name) setShopName(data.shop_name);
        else if (data.shopName) setShopName(data.shopName);
      })
      .catch((err) => console.error("Error fetching shop settings:", err));
  };

  useEffect(() => {
    fetchShopSettings();
  }, []);

  /* =========================
      STATISTICS & SOCKET.IO
  ========================= */
  const loadStats = async () => {
    try {
      setLoadingStats(true);

      const [customersResponse, devicesResponse, controllersResponse] = await Promise.all([
        fetch(`${API_URL}/api/customers`).catch(() => null),
        fetch(`${API_URL}/api/devices`).catch(() => null),
        fetch(`${API_URL}/api/controllers`).catch(() => null),
      ]);

      const customers = customersResponse && customersResponse.ok ? await readJsonResponse(customersResponse) : [];
      const devices = devicesResponse && devicesResponse.ok ? await readJsonResponse(devicesResponse) : [];
      const controllers = controllersResponse && controllersResponse.ok ? await readJsonResponse(controllersResponse) : [];

      const devicesInside = Array.isArray(devices)
        ? devices.filter((device) => device.status === "داخل المحل" || device.status === "Inside Shop" || device.status === "busy").length
        : 0;

      setStats({
        customers: Array.isArray(customers) ? customers.length : 0,
        devices: Array.isArray(devices) ? devices.length : 0,
        controllers: Array.isArray(controllers)
          ? controllers.reduce((total, controller) => total + Number(controller.quantity || 1), 0)
          : 0,
        devicesInside,
      });
    } catch (error) {
      console.error("Stats error:", error);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    loadStats();

    // الاستماع للتحديثات اللحظية عبر Socket.IO
    socket.on("data_updated", () => {
      loadStats();
      fetchShopSettings();
    });

    return () => {
      socket.off("data_updated");
    };
  }, [activePage]);

  /* =========================
      PAGES RENDER
  ========================= */
  const renderPage = () => {
    if (activePage === "customers") return <Customers />;
    if (activePage === "devices") return <Devices />;
    if (activePage === "controllers") return <Controllers />;
    if (activePage === "invoices") return <Invoices />;
    if (activePage === "settings") {
      return (
        <Settings
          settings={{ language, theme, shopName }}
          setSettings={(newSettings) => {
            if (newSettings.language !== undefined) setLanguage(newSettings.language);
            if (newSettings.theme !== undefined) setTheme(newSettings.theme);
            if (newSettings.shopName !== undefined) setShopName(newSettings.shopName);
          }}
        />
      );
    }

    return (
      <main className="dashboard">
        <section className="welcome">
          <div>
            <p className="small-title">{t.welcome}</p>
            <h2>{t.welcomeTitle}</h2>
            <p>{t.welcomeText}</p>
          </div>
          <button className="main-button" onClick={() => setActivePage("devices")}>
            {t.newDevice}
          </button>
        </section>

        <section className="stats">
          <div className="stat-card">
            <span>👥</span>
            <div>
              <small>{t.totalCustomers}</small>
              <strong>{loadingStats ? "..." : stats.customers}</strong>
            </div>
          </div>

          <div className="stat-card">
            <span>🎮</span>
            <div>
              <small>{t.totalDevices}</small>
              <strong>{loadingStats ? "..." : stats.devices}</strong>
            </div>
          </div>

          <div className="stat-card">
            <span>🕹️</span>
            <div>
              <small>{t.totalControllers}</small>
              <strong>{loadingStats ? "..." : stats.controllers}</strong>
            </div>
          </div>

          <div className="stat-card">
            <span>📥</span>
            <div>
              <small>{t.devicesInside}</small>
              <strong>{loadingStats ? "..." : stats.devicesInside}</strong>
            </div>
          </div>
        </section>

        <section className="content-card">
          <div className="card-title">
            <div>
              <h3>{t.management}</h3>
              <p>{t.chooseSection}</p>
            </div>
            <button className="secondary-button" onClick={loadStats}>
              {t.refresh}
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "15px",
              marginTop: "20px",
            }}
          >
            <button className="secondary-button" onClick={() => setActivePage("customers")}>
              👥 {t.customers}
            </button>
            <button className="secondary-button" onClick={() => setActivePage("devices")}>
              🎮 {t.devices}
            </button>
            <button className="secondary-button" onClick={() => setActivePage("controllers")}>
              🕹️ {t.controllers}
            </button>
            <button className="secondary-button" onClick={() => setActivePage("invoices")}>
              🧾 {t.invoices}
            </button>
          </div>
        </section>
      </main>
    );
  };

  return (
    <div className={`app ${theme === "light" ? "light-theme" : "dark-theme"}`}>
      <header className="top-bar">
        <div className="brand">
          <div className="brand-icon">🎮</div>
          <div>
            <h1>ABU AL-KHAIR</h1>
            <span>GAMING SHOP</span>
          </div>
        </div>

        <div className="shop-info">
          <strong>{shopName}</strong>
          <span>{t.shopSystem}</span>
        </div>

        <button onClick={onLogout} className="logout-button">
          {t.logout}
        </button>
      </header>

      <nav className="main-nav">
        <button className="secondary-button" onClick={() => setActivePage("dashboard")}>
          🏠 {t.home}
        </button>
        <button className="secondary-button" onClick={() => setActivePage("customers")}>
          👥 {t.customers}
        </button>
        <button className="secondary-button" onClick={() => setActivePage("devices")}>
          🎮 {t.devices}
        </button>
        <button className="secondary-button" onClick={() => setActivePage("controllers")}>
          🕹️ {t.controllers}
        </button>
        <button className="secondary-button" onClick={() => setActivePage("invoices")}>
          🧾 {t.invoices}
        </button>
        <button className="secondary-button" onClick={() => setActivePage("settings")}>
          ⚙️ {t.settings}
        </button>
      </nav>

      {renderPage()}

      <footer>
        <span>{shopName}</span>
        <span>{t.footer}</span>
      </footer>
    </div>
  );
}

function App() {
  const [loggedIn, setLoggedIn] = useState(false);

  if (!loggedIn) {
    return <Login onLogin={() => setLoggedIn(true)} />;
  }

  return <Dashboard onLogout={() => setLoggedIn(false)} />;
}

export default App;
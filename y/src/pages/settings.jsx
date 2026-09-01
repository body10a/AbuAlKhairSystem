import { useEffect, useState } from "react";

const API_URL = "";

function Settings({ settings, setSettings }) {
  const [username, setUsername] = useState("admin");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [shopName, setShopName] = useState(settings.shopName);
  const [loading, setLoading] = useState(true);

  // Username, password and shop name are now stored on the server (in the
  // same database as everything else) instead of localStorage, so they
  // stay in sync across every device instead of resetting whenever a
  // browser's local storage gets cleared.
  useEffect(() => {
    let cancelled = false;

    fetch(`${API_URL}/api/settings`)
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        if (data.username) setUsername(data.username);
        if (data.shopName) {
          setShopName(data.shopName);
          setSettings((prev) => ({ ...prev, shopName: data.shopName }));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveAccount = async () => {
    if (!username.trim()) {
      alert("اسم المستخدم مطلوب");
      return;
    }

    if (!currentPassword) {
      alert("اكتب كلمة السر الحالية");
      return;
    }

    if (!newPassword) {
      alert("اكتب كلمة السر الجديدة");
      return;
    }

    if (newPassword.length < 4) {
      alert("كلمة السر يجب أن تكون 4 أحرف أو أرقام على الأقل");
      return;
    }

    if (newPassword !== confirmPassword) {
      alert("تأكيد كلمة السر غير مطابق");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/settings/account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newUsername: username.trim(),
          newPassword,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        alert(data.message || "تعذر حفظ بيانات الدخول");
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      alert("تم تغيير بيانات الدخول بنجاح، وهتحتاج تسجل دخول بيها من أي جهاز تاني");
    } catch {
      alert("تعذر الاتصال بالسيرفر");
    }
  };

  const saveShopName = async () => {
    if (!shopName.trim()) {
      alert("اسم المحل مطلوب");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/settings/shop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopName: shopName.trim() }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        alert(data.message || "تعذر حفظ اسم المحل");
        return;
      }

      setSettings((prev) => ({
        ...prev,
        shopName: data.shopName || shopName.trim(),
      }));

      alert("تم حفظ اسم المحل");
    } catch {
      alert("تعذر الاتصال بالسيرفر");
    }
  };

  const resetSettings = async () => {
    const confirmReset = window.confirm(
      "هل أنت متأكد من إعادة جميع الإعدادات للوضع الافتراضي؟"
    );

    if (!confirmReset) return;

    try {
      const response = await fetch(`${API_URL}/api/settings/reset`, {
        method: "POST",
      });

      if (!response.ok) {
        alert("تعذر إعادة الإعدادات");
        return;
      }
    } catch {
      alert("تعذر الاتصال بالسيرفر");
      return;
    }

    localStorage.setItem("app_language", "ar");
    localStorage.setItem("app_theme", "dark");

    setUsername("admin");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShopName("ABU AL-KHAIR GAMING SHOP");

    setSettings({
      language: "ar",
      theme: "dark",
      shopName: "ABU AL-KHAIR GAMING SHOP",
    });

    alert("تم إعادة الإعدادات للوضع الافتراضي");
  };

  return (
    <main className="dashboard settings-page">

      <div className="page-header">
        <div>
          <p className="small-title">
            SETTINGS
          </p>

          <h2>
            الإعدادات
          </h2>

          <p>
            تحكم في شكل النظام وبيانات الدخول
            وإعدادات المحل.
          </p>
        </div>
      </div>

      {/* إعدادات النظام */}

      <section className="settings-card">

        <div className="settings-title">
          <div>
            <h3>
              ⚙️ إعدادات النظام
            </h3>

            <p>
              اختر اللغة والمظهر المناسب لك.
            </p>
          </div>
        </div>

        <div className="settings-grid">

          <div className="setting-item">
            <label>
              🌐 اللغة
            </label>

            <select
              value={settings.language}
              onChange={(e) => {
                const language = e.target.value;

                localStorage.setItem("app_language", language);

                setSettings((prev) => ({
                  ...prev,
                  language,
                }));
              }}
            >
              <option value="ar">
                العربية
              </option>

              <option value="en">
                English
              </option>
            </select>
          </div>

          <div className="setting-item">
            <label>
              🌓 المظهر
            </label>

            <select
              value={settings.theme}
              onChange={(e) => {
                const theme = e.target.value;

                localStorage.setItem("app_theme", theme);

                setSettings((prev) => ({
                  ...prev,
                  theme,
                }));
              }}
            >
              <option value="dark">
                🌙 داكن
              </option>

              <option value="light">
                ☀️ فاتح
              </option>
            </select>
          </div>

        </div>

      </section>

      {/* بيانات الدخول */}

      <section className="settings-card">

        <div className="settings-title">
          <div>
            <h3>
              🔐 بيانات الدخول
            </h3>

            <p>
              يمكنك تغيير اسم المستخدم وكلمة السر بأمان. البيانات دي بقت
              متخزنة على السيرفر فهتشتغل من أي جهاز.
            </p>
          </div>
        </div>

        <div className="settings-grid">

          <div className="setting-item">
            <label>
              👤 اسم المستخدم الجديد
            </label>

            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="اسم المستخدم"
              disabled={loading}
            />
          </div>

          <div className="setting-item">
            <label>
              🔑 كلمة السر الحالية
            </label>

            <input
              type={showPassword ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="اكتب كلمة السر الحالية"
            />
          </div>

          <div className="setting-item">
            <label>
              🔐 كلمة السر الجديدة
            </label>

            <input
              type={showPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="اكتب كلمة السر الجديدة"
            />
          </div>

          <div className="setting-item">
            <label>
              🔐 تأكيد كلمة السر الجديدة
            </label>

            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="أعد كتابة كلمة السر الجديدة"
            />
          </div>

        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={() => setShowPassword(!showPassword)}
          style={{ marginTop: "15px" }}
        >
          {showPassword ? "🙈 إخفاء كلمات السر" : "👁️ إظهار كلمات السر"}
        </button>

        <br />

        <button
          className="main-button settings-save"
          onClick={saveAccount}
        >
          💾 حفظ بيانات الدخول
        </button>

      </section>

      {/* بيانات المحل */}

      <section className="settings-card">

        <div className="settings-title">
          <div>
            <h3>
              🏪 بيانات المحل
            </h3>

            <p>
              تعديل اسم المحل الظاهر في النظام.
            </p>
          </div>
        </div>

        <div className="setting-item">
          <label>
            اسم المحل
          </label>

          <input
            type="text"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            placeholder="اسم المحل"
            disabled={loading}
          />
        </div>

        <button
          className="main-button settings-save"
          onClick={saveShopName}
        >
          💾 حفظ اسم المحل
        </button>

      </section>

      {/* إعادة الإعدادات */}

      <section className="settings-card danger-settings">

        <div>
          <h3>
            ⚠️ إعدادات متقدمة
          </h3>

          <p>
            إعادة إعدادات النظام للوضع الافتراضي.
          </p>
        </div>

        <button
          className="reset-settings-button"
          onClick={resetSettings}
        >
          🔄 إعادة الإعدادات الافتراضية
        </button>

      </section>

    </main>
  );
}

export default Settings;

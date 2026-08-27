import { useState } from "react";

function Settings({ settings, setSettings }) {
  const [username, setUsername] = useState(
    localStorage.getItem("admin_username") || "admin"
  );

  const [currentPassword, setCurrentPassword] =
    useState("");

  const [newPassword, setNewPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [shopName, setShopName] = useState(
    localStorage.getItem("shop_name") ||
      "ABU AL-KHAIR GAMING SHOP"
  );

  const saveAccount = () => {
    const savedUsername =
      localStorage.getItem("admin_username") ||
      "admin";

    const savedPassword =
      localStorage.getItem("admin_password") ||
      "1234";

    if (!username.trim()) {
      alert("اسم المستخدم مطلوب");
      return;
    }

    if (!currentPassword) {
      alert("اكتب كلمة السر الحالية");
      return;
    }

    if (currentPassword !== savedPassword) {
      alert("كلمة السر الحالية غير صحيحة");
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

    localStorage.setItem(
      "admin_username",
      username.trim()
    );

    localStorage.setItem(
      "admin_password",
      newPassword
    );

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");

    alert("تم تغيير بيانات الدخول بنجاح");
  };

  const saveShopName = () => {
    if (!shopName.trim()) {
      alert("اسم المحل مطلوب");
      return;
    }

    const newShopName = shopName.trim();

    localStorage.setItem(
      "shop_name",
      newShopName
    );

    setSettings((prev) => ({
      ...prev,
      shopName: newShopName,
    }));

    alert("تم حفظ اسم المحل");
  };

  const resetSettings = () => {
    const confirmReset = window.confirm(
      "هل أنت متأكد من إعادة جميع الإعدادات للوضع الافتراضي؟"
    );

    if (!confirmReset) return;

    localStorage.setItem(
      "admin_username",
      "admin"
    );

    localStorage.setItem(
      "admin_password",
      "1234"
    );

    localStorage.setItem(
      "shop_name",
      "ABU AL-KHAIR GAMING SHOP"
    );

    localStorage.setItem(
      "app_language",
      "ar"
    );

    localStorage.setItem(
      "app_theme",
      "dark"
    );

    setUsername("admin");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShopName(
      "ABU AL-KHAIR GAMING SHOP"
    );

    setSettings({
      language: "ar",
      theme: "dark",
      shopName:
        "ABU AL-KHAIR GAMING SHOP",
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
                const language =
                  e.target.value;

                localStorage.setItem(
                  "app_language",
                  language
                );

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
                const theme =
                  e.target.value;

                localStorage.setItem(
                  "app_theme",
                  theme
                );

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
              يمكنك تغيير اسم المستخدم وكلمة السر بأمان.
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
              onChange={(e) =>
                setUsername(e.target.value)
              }
              placeholder="اسم المستخدم"
            />
          </div>

          <div className="setting-item">
            <label>
              🔑 كلمة السر الحالية
            </label>

            <input
              type={
                showPassword
                  ? "text"
                  : "password"
              }
              value={currentPassword}
              onChange={(e) =>
                setCurrentPassword(
                  e.target.value
                )
              }
              placeholder="اكتب كلمة السر الحالية"
            />
          </div>

          <div className="setting-item">
            <label>
              🔐 كلمة السر الجديدة
            </label>

            <input
              type={
                showPassword
                  ? "text"
                  : "password"
              }
              value={newPassword}
              onChange={(e) =>
                setNewPassword(
                  e.target.value
                )
              }
              placeholder="اكتب كلمة السر الجديدة"
            />
          </div>

          <div className="setting-item">
            <label>
              🔐 تأكيد كلمة السر الجديدة
            </label>

            <input
              type={
                showPassword
                  ? "text"
                  : "password"
              }
              value={confirmPassword}
              onChange={(e) =>
                setConfirmPassword(
                  e.target.value
                )
              }
              placeholder="أعد كتابة كلمة السر الجديدة"
            />
          </div>

        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={() =>
            setShowPassword(!showPassword)
          }
          style={{
            marginTop: "15px",
          }}
        >
          {showPassword
            ? "🙈 إخفاء كلمات السر"
            : "👁️ إظهار كلمات السر"}
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
            onChange={(e) =>
              setShopName(e.target.value)
            }
            placeholder="اسم المحل"
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
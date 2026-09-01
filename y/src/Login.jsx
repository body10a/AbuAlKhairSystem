import { useState } from "react";
import "./Login.css";

const API_URL = "";

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/settings/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.ok) {
        onLogin();
      } else {
        setError(
          data.message || "اسم المستخدم أو كلمة المرور غير صحيحة"
        );
      }
    } catch {
      setError(
        "تعذر الاتصال بالسيرفر، تأكد من اتصال الإنترنت وحاول مرة أخرى"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">

      <div className="login-box">

        <div className="login-logo">
          🎮
        </div>

        <h1>
          ABU AL-KHAIR
        </h1>

        <h2>
          GAMING SHOP
        </h2>

        <p className="login-subtitle">
          نظام إدارة الأجهزة والعملاء
        </p>

        <form onSubmit={handleSubmit}>

          <label>
            اسم المستخدم
          </label>

          <input
            type="text"
            placeholder="اكتب اسم المستخدم"
            value={username}
            onChange={(e) =>
              setUsername(e.target.value)
            }
            autoComplete="username"
          />

          <label>
            كلمة المرور
          </label>

          <input
            type="password"
            placeholder="اكتب كلمة المرور"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
            autoComplete="current-password"
          />

          {error && (
            <div className="login-error">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}>
            {loading ? "جاري الدخول..." : "تسجيل الدخول"}
          </button>

        </form>

        <div className="login-footer">
          ABU AL-KHAIR GAMING SHOP © 2026
        </div>

      </div>

    </div>
  );
}

export default Login;

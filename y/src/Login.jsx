import { useState } from "react";
import "./Login.css";

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();

    const savedUsername =
      localStorage.getItem("admin_username") || "admin";

    const savedPassword =
      localStorage.getItem("admin_password") || "1234";

    if (
      username.trim() === savedUsername &&
      password === savedPassword
    ) {
      setError("");
      onLogin();
    } else {
      setError(
        "اسم المستخدم أو كلمة المرور غير صحيحة"
      );
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

          <button type="submit">
            تسجيل الدخول
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
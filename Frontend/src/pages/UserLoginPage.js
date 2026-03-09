import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import BACKEND_URL from "../config";

export default function UserLoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login"); // "login" | "register"

  // Shared fields
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  // Register-only fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!phone.trim()) return setError("Please enter your phone number");
    setError(""); setLoading(true);
    try {
      const res = await axios.post(`${BACKEND_URL}/api/auth/user/login`, {
        phone: phone.trim(),
        name: name.trim() || undefined,
        password: password.trim() || undefined,
      });
      localStorage.setItem("ucab_token", res.data.token);
      localStorage.setItem("ucab_user", JSON.stringify(res.data.user));
      navigate("/user");
    } catch (e) {
      setError(e.response?.data?.message || "Connection failed — check your network");
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!phone.trim()) return setError("Phone number is required");
    if (!name.trim()) return setError("Your name is required");
    if (password && password !== confirmPassword) return setError("Passwords do not match");
    setError(""); setLoading(true);
    try {
      const res = await axios.post(`${BACKEND_URL}/api/auth/user/register`, {
        phone: phone.trim(),
        name: name.trim(),
        email: email.trim() || undefined,
        password: password.trim() || undefined,
      });
      localStorage.setItem("ucab_token", res.data.token);
      localStorage.setItem("ucab_user", JSON.stringify(res.data.user));
      navigate("/user");
    } catch (e) {
      setError(e.response?.data?.message || "Registration failed — please try again");
      setLoading(false);
    }
  };

  const isLogin = mode === "login";

  return (
    <div className="login-page">
      <div className="login-logo">uride <span className="logo-accent">services</span></div>
      <div className="login-tagline">Your city ride, simplified 🚖</div>

      <div className="login-card">
        <div className="login-role-badge rider-badge">🙋 Rider</div>

        {/* Mode toggle */}
        <div style={{ display: "flex", gap: 0, marginBottom: 20, borderRadius: 12, overflow: "hidden", border: "1px solid #333" }}>
          {["login", "register"].map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(""); }}
              style={{
                flex: 1, padding: "10px 0", border: "none", cursor: "pointer",
                fontWeight: 700, fontSize: 14,
                background: mode === m ? "#00c853" : "transparent",
                color: mode === m ? "#fff" : "#aaa",
                transition: "all .2s",
              }}>
              {m === "login" ? "Login" : "Register"}
            </button>
          ))}
        </div>

        <h2 style={{ marginTop: 0 }}>{isLogin ? "Welcome back" : "Create account"}</h2>
        <p>{isLogin ? "Enter your phone to book a ride" : "Sign up to start riding instantly"}</p>

        {!isLogin && (
          <div className="input-group">
            <label>👤 Full Name <span style={{ color: "#e53935" }}>*</span></label>
            <input type="text" placeholder="e.g. Arjun Sharma"
              value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        )}

        <div className="input-group">
          <label>📱 Phone Number <span style={{ color: "#e53935" }}>*</span></label>
          <input type="tel" placeholder="+91 98765 43210"
            value={phone} onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (isLogin ? handleLogin() : handleRegister())} />
        </div>

        {isLogin && (
          <div className="input-group">
            <label>👤 Your Name <span style={{ color: "#555" }}>(optional)</span></label>
            <input type="text" placeholder="e.g. Arjun Sharma"
              value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        )}

        {!isLogin && (
          <div className="input-group">
            <label>📧 Email <span style={{ color: "#555" }}>(optional)</span></label>
            <input type="email" placeholder="you@example.com"
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        )}

        {(!isLogin || true) && (
          <div className="input-group">
            <label>🔒 Password <span style={{ color: "#555" }}>(optional)</span></label>
            <div style={{ position: "relative" }}>
              <input
                type={showPass ? "text" : "password"}
                placeholder={isLogin ? "Leave blank if phone-only login" : "Set a password (optional)"}
                value={password} onChange={(e) => setPassword(e.target.value)}
                style={{ paddingRight: 40 }} />
              <button
                type="button"
                onClick={() => setShowPass((s) => !s)}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", fontSize: 16 }}>
                {showPass ? "🙈" : "👁"}
              </button>
            </div>
          </div>
        )}

        {!isLogin && (
          <div className="input-group">
            <label>🔒 Confirm Password</label>
            <input
              type={showPass ? "text" : "password"}
              placeholder="Repeat your password"
              value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
        )}

        {error && <div className="login-error">{error}</div>}

        <button
          className="btn-primary"
          onClick={isLogin ? handleLogin : handleRegister}
          disabled={loading || !phone.trim()}>
          {loading ? "Please wait…" : isLogin ? "Let\'s Go 🚖" : "Create Account 🎉"}
        </button>

        <div className="login-switch-link">
          Are you a captain?{" "}
          <Link to="/login/captain">Login here →</Link>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import BACKEND_URL from "../config";

export default function UserLoginPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!phone.trim()) return setError("Please enter your phone number");
    setError(""); setLoading(true);
    try {
      const res = await axios.post(`${BACKEND_URL}/api/auth/user/login`, {
        phone: phone.trim(),
        name: name.trim() || undefined,
      });
      localStorage.setItem("ucab_token", res.data.token);
      localStorage.setItem("ucab_user", JSON.stringify(res.data.user));
      navigate("/user");
    } catch (e) {
      setError(e.response?.data?.message || "Connection failed — check your network");
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-logo">UCab <span className="logo-accent">Services</span></div>
      <div className="login-tagline">Your city ride, simplified 🚖</div>

      <div className="login-card">
        <div className="login-role-badge rider-badge">🙋 Rider Login</div>
        <h2>Welcome back</h2>
        <p>Enter your phone to book a ride instantly</p>

        <div className="input-group">
          <label>👤 Your Name <span style={{ color: "#555" }}>(optional)</span></label>
          <input type="text" placeholder="e.g. Arjun Sharma"
            value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="input-group">
          <label>📱 Phone Number</label>
          <input type="tel" placeholder="+91 98765 43210"
            value={phone} onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()} />
        </div>

        {error && <div className="login-error">{error}</div>}

        <button className="btn-primary" onClick={handleLogin} disabled={loading || !phone.trim()}>
          {loading ? "Please wait…" : "Let's Go 🚖"}
        </button>

        <div className="login-switch-link">
          Are you a captain?{" "}
          <Link to="/login/captain">Login here →</Link>
        </div>
      </div>
    </div>
  );
}

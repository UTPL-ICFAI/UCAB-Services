import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import BACKEND_URL from "../config";

const VEHICLE_TYPES = [
  { id: "go", label: "UCab Go", icon: "🚗", desc: "Affordable sedan" },
  { id: "premier", label: "Premier", icon: "🚙", desc: "Comfortable ride" },
  { id: "auto", label: "Auto", icon: "🛺", desc: "Quick & cheap" },
  { id: "bike", label: "Bike", icon: "🏍️", desc: "Fastest option" },
];

export default function CaptainLoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");   // "login" | "register"
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Login fields
  const [lPhone, setLPhone] = useState("");
  const [lPass, setLPass] = useState("");

  // Register fields
  const [rName, setRName] = useState("");
  const [rPhone, setRPhone] = useState("");
  const [rPass, setRPass] = useState("");
  const [rVType, setRVType] = useState("go");
  const [rPlate, setRPlate] = useState("");
  const [rColor, setRColor] = useState("");
  const [rModel, setRModel] = useState("");

  const err = (msg) => { setError(msg); setLoading(false); };

  const handleLogin = async () => {
    if (!lPhone || !lPass) return err("Phone and password required");
    setError(""); setLoading(true);
    try {
      const res = await axios.post(`${BACKEND_URL}/api/auth/captain/login`, {
        phone: lPhone, password: lPass
      });
      localStorage.setItem("ucab_token", res.data.token);
      localStorage.setItem("ucab_user", JSON.stringify(res.data.captain));
      navigate("/captain");
    } catch (e) { err(e.response?.data?.message || "Login failed"); }
  };

  const handleRegister = async () => {
    if (!rName || !rPhone || !rPass || !rPlate || !rColor || !rModel)
      return err("Please fill all fields");
    setError(""); setLoading(true);
    try {
      const res = await axios.post(`${BACKEND_URL}/api/auth/captain/register`, {
        name: rName, phone: rPhone, password: rPass,
        vehicle: { type: rVType, plate: rPlate, color: rColor, model: rModel }
      });
      localStorage.setItem("ucab_token", res.data.token);
      localStorage.setItem("ucab_user", JSON.stringify(res.data.captain));
      navigate("/captain");
    } catch (e) { err(e.response?.data?.message || "Registration failed"); }
  };

  return (
    <div className="login-page">
      <div className="login-logo">UCab <span className="logo-accent">Services</span></div>
      <div className="login-tagline">Start earning with every trip 🚗</div>

      <div className="login-card">
        <div className="login-role-badge captain-badge">🚗 Captain Portal</div>

        <div className="captain-mode-switch">
          <button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>Login</button>
          <button className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }}>Register</button>
        </div>

        {mode === "login" && (
          <>
            <h2>Captain Login</h2>
            <div className="input-group">
              <label>📱 Phone Number</label>
              <input type="tel" placeholder="+91 98765 43210"
                value={lPhone} onChange={(e) => setLPhone(e.target.value)} />
            </div>
            <div className="input-group">
              <label>🔒 Password</label>
              <input type="password" placeholder="Your password"
                value={lPass} onChange={(e) => setLPass(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()} />
            </div>
            {error && <div className="login-error">{error}</div>}
            <button className="btn-primary" onClick={handleLogin} disabled={loading}>
              {loading ? "Logging in…" : "Start Driving →"}
            </button>
          </>
        )}

        {mode === "register" && (
          <>
            <h2>Create Captain Account</h2>
            <div className="input-group">
              <label>👤 Full Name</label>
              <input type="text" placeholder="e.g. Ravi Kumar"
                value={rName} onChange={(e) => setRName(e.target.value)} />
            </div>
            <div className="input-row">
              <div className="input-group">
                <label>📱 Phone</label>
                <input type="tel" placeholder="98765 43210"
                  value={rPhone} onChange={(e) => setRPhone(e.target.value)} />
              </div>
              <div className="input-group">
                <label>🔒 Password</label>
                <input type="password" placeholder="Create password"
                  value={rPass} onChange={(e) => setRPass(e.target.value)} />
              </div>
            </div>

            <div className="input-group">
              <label>🚘 Vehicle Type</label>
              <div className="vehicle-type-grid">
                {VEHICLE_TYPES.map((v) => (
                  <div key={v.id}
                    className={`vtype-card ${rVType === v.id ? "selected" : ""}`}
                    onClick={() => setRVType(v.id)}>
                    <span className="vtype-icon">{v.icon}</span>
                    <span className="vtype-label">{v.label}</span>
                    <span className="vtype-desc">{v.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="input-row">
              <div className="input-group">
                <label>🔖 Plate No.</label>
                <input type="text" placeholder="MH 01 AB 1234"
                  value={rPlate} onChange={(e) => setRPlate(e.target.value.toUpperCase())} />
              </div>
              <div className="input-group">
                <label>🎨 Color</label>
                <input type="text" placeholder="White"
                  value={rColor} onChange={(e) => setRColor(e.target.value)} />
              </div>
            </div>

            <div className="input-group">
              <label>🚗 Vehicle Model</label>
              <input type="text" placeholder="e.g. Maruti Swift"
                value={rModel} onChange={(e) => setRModel(e.target.value)} />
            </div>

            {error && <div className="login-error">{error}</div>}
            <button className="btn-primary" onClick={handleRegister} disabled={loading}>
              {loading ? "Creating account…" : "Create Account →"}
            </button>
          </>
        )}

        <div className="login-switch-link">
          Looking to book a ride?{" "}
          <Link to="/login/user">Rider login →</Link>
        </div>
      </div>
    </div>
  );
}

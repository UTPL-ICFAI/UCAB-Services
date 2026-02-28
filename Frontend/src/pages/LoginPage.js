import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import BACKEND_URL from "../config";

const VEHICLE_TYPES = [
  { id: "go", label: "BolaCab Go", icon: "🚗", desc: "Affordable sedan" },
  { id: "premier", label: "Premier", icon: "🚙", desc: "Comfortable ride" },
  { id: "auto", label: "Auto", icon: "🛺", desc: "Quick & cheap" },
  { id: "bike", label: "Bike", icon: "🏍️", desc: "Fastest option" },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("user");           // "user" | "captain"
  const [captainMode, setCaptainMode] = useState("login");    // "login" | "register"

  // User fields
  const [uPhone, setUPhone] = useState("");
  const [uName, setUName] = useState("");
  const [uStep, setUStep] = useState("phone");              // "phone" | "name"

  // Captain login fields
  const [cPhone, setCPhone] = useState("");
  const [cPass, setCPass] = useState("");

  // Captain register fields
  const [rName, setRName] = useState("");
  const [rPhone, setRPhone] = useState("");
  const [rPass, setRPass] = useState("");
  const [rVType, setRVType] = useState("go");
  const [rPlate, setRPlate] = useState("");
  const [rColor, setRColor] = useState("");
  const [rModel, setRModel] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const err = (msg) => { setError(msg); setLoading(false); };

  // ── USER LOGIN ─────────────────────────────────────────────
  const handleUserLogin = async () => {
    if (!uPhone.trim()) return err("Please enter your phone number");
    setError(""); setLoading(true);
    try {
      const res = await axios.post(`${BACKEND_URL}/api/auth/user/login`, {
        phone: uPhone.trim(),
        name: uName.trim() || undefined
      });
      localStorage.setItem("ucab_token", res.data.token);
      localStorage.setItem("ucab_user", JSON.stringify(res.data.user));
      navigate("/user");
    } catch (e) {
      err(e.response?.data?.message || "Connection failed — make sure you're on the same WiFi");
    }
  };

  // ── CAPTAIN LOGIN ──────────────────────────────────────────
  const handleCaptainLogin = async () => {
    setError(""); setLoading(true);
    try {
      const res = await axios.post(`${BACKEND_URL}/api/auth/captain/login`, {
        phone: cPhone, password: cPass
      });
      localStorage.setItem("ucab_token", res.data.token);
      localStorage.setItem("ucab_user", JSON.stringify(res.data.captain));
      navigate("/captain");
    } catch (e) {
      err(e.response?.data?.message || "Login failed");
    }
  };

  // ── CAPTAIN REGISTER ───────────────────────────────────────
  const handleCaptainRegister = async () => {
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
    } catch (e) {
      err(e.response?.data?.message || "Registration failed");
    }
  };

  return (
    <div className="login-page">
      <div className="login-logo">UCab</div>
      <div className="login-tagline">Your city. Your ride. 🚖</div>

      {/* ── Tab switch ──────────────────────────────────────── */}
      <div className="login-tabs">
        <button className={`ltab ${tab === "user" ? "active" : ""}`}
          onClick={() => { setTab("user"); setError(""); }}>
          🙋 I'm a Rider
        </button>
        <button className={`ltab ${tab === "captain" ? "active" : ""}`}
          onClick={() => { setTab("captain"); setError(""); }}>
          🚗 I'm a Captain
        </button>
      </div>

      <div className="login-card">

        {/* ════════════════ USER TAB ════════════════ */}
        {tab === "user" && (
          <>
            <h2>Rider Login</h2>
            <p>Enter your details to book a ride</p>

            <div className="input-group">
              <label>👤 Your Name (optional)</label>
              <input type="text" placeholder="e.g. Arjun Sharma"
                value={uName} onChange={(e) => setUName(e.target.value)} />
            </div>

            <div className="input-group">
              <label>📱 Phone Number</label>
              <input type="tel" placeholder="+91 98765 43210"
                value={uPhone} onChange={(e) => setUPhone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUserLogin()} />
            </div>

            {error && <div className="login-error">{error}</div>}

            <button className="btn-primary" onClick={handleUserLogin}
              disabled={loading || !uPhone.trim()}>
              {loading ? "Please wait…" : "Let's Go 🚖"}
            </button>
          </>
        )}

        {/* ════════════════ CAPTAIN TAB ════════════════ */}
        {tab === "captain" && (
          <>
            <div className="captain-mode-switch">
              <button className={captainMode === "login" ? "active" : ""}
                onClick={() => { setCaptainMode("login"); setError(""); }}>
                Login
              </button>
              <button className={captainMode === "register" ? "active" : ""}
                onClick={() => { setCaptainMode("register"); setError(""); }}>
                Register
              </button>
            </div>

            {/* ── Captain Login ── */}
            {captainMode === "login" && (
              <>
                <h2>Captain Login</h2>
                <div className="input-group">
                  <label>📱 Phone Number</label>
                  <input type="tel" placeholder="+91 98765 43210"
                    value={cPhone} onChange={(e) => setCPhone(e.target.value)} />
                </div>
                <div className="input-group">
                  <label>🔒 Password</label>
                  <input type="password" placeholder="Your password"
                    value={cPass} onChange={(e) => setCPass(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCaptainLogin()} />
                </div>
                {error && <div className="login-error">{error}</div>}
                <button className="btn-primary" onClick={handleCaptainLogin}
                  disabled={loading || !cPhone || !cPass}>
                  {loading ? "Logging in…" : "Start Driving →"}
                </button>
                <p className="switch-hint">
                  New captain?{" "}
                  <span onClick={() => { setCaptainMode("register"); setError(""); }}>
                    Register here
                  </span>
                </p>
              </>
            )}

            {/* ── Captain Register ── */}
            {captainMode === "register" && (
              <>
                <h2>Register as Captain</h2>

                <div className="input-group">
                  <label>👤 Full Name</label>
                  <input type="text" placeholder="e.g. Ravi Kumar"
                    value={rName} onChange={(e) => setRName(e.target.value)} />
                </div>
                <div className="input-group">
                  <label>📱 Phone Number</label>
                  <input type="tel" placeholder="+91 98765 43210"
                    value={rPhone} onChange={(e) => setRPhone(e.target.value)} />
                </div>
                <div className="input-group">
                  <label>🔒 Password</label>
                  <input type="password" placeholder="Create a password"
                    value={rPass} onChange={(e) => setRPass(e.target.value)} />
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

                <button className="btn-primary" onClick={handleCaptainRegister}
                  disabled={loading}>
                  {loading ? "Registering…" : "Create Account →"}
                </button>

                <p className="switch-hint">
                  Already registered?{" "}
                  <span onClick={() => { setCaptainMode("login"); setError(""); }}>
                    Login here
                  </span>
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

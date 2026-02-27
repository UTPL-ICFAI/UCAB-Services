import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import BACKEND_URL from "../../config";

export default function FleetOwnerLoginPage() {
    const navigate = useNavigate();
    const [tab, setTab] = useState("login");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [showPw, setShowPw] = useState(false);

    // Login state
    const [loginEmail, setLoginEmail] = useState("");
    const [loginPw, setLoginPw] = useState("");

    // Register state
    const [form, setForm] = useState({
        ownerName: "", companyName: "", phone: "", email: "",
        address: "", totalVehicles: "", password: "", confirmPw: "",
    });

    const set = (f) => (e) => setForm({ ...form, [f]: e.target.value });

    /* ── Login ── */
    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true); setError("");
        try {
            const res = await axios.post(`${BACKEND_URL}/api/fleet/owners/login`, {
                email: loginEmail.trim(),
                password: loginPw,
            });
            localStorage.setItem("fleet_owner", JSON.stringify(res.data.owner));
            navigate("/fleet/dashboard");
        } catch (err) {
            setError(err.response?.data?.message || "Login failed. Check email and password.");
        } finally { setLoading(false); }
    };

    /* ── Register ── */
    const handleRegister = async (e) => {
        e.preventDefault();
        setError("");
        if (form.password.length < 6) { setError("Password must be at least 6 characters"); return; }
        if (form.password !== form.confirmPw) { setError("Passwords do not match"); return; }
        setLoading(true);
        try {
            const { confirmPw: _, ...payload } = form;
            const res = await axios.post(`${BACKEND_URL}/api/fleet/owners`, {
                ...payload, totalVehicles: Number(payload.totalVehicles),
            });
            localStorage.setItem("fleet_owner", JSON.stringify(res.data.owner));
            navigate("/fleet/dashboard");
        } catch (err) {
            setError(err.response?.data?.message || "Registration failed");
        } finally { setLoading(false); }
    };

    return (
        <div style={page}>
            <div style={card}>
                {/* Header */}
                <div style={{ textAlign: "center", marginBottom: 24 }}>
                    <div style={{ fontSize: 48, marginBottom: 8 }}>🚌</div>
                    <h2 style={{ color: "#fff", fontWeight: 800, fontSize: 22, margin: 0 }}>Fleet Owner Portal</h2>
                    <p style={{ color: "#888", fontSize: 13, marginTop: 6 }}>UCab Services — Manage your fleet</p>
                </div>

                {/* Tabs */}
                <div style={tabRow}>
                    {["login", "register"].map((t) => (
                        <button key={t} onClick={() => { setTab(t); setError(""); }}
                            style={{ ...tabBtn, ...(tab === t ? tabActive : {}) }}>
                            {t === "login" ? "Login" : "Register"}
                        </button>
                    ))}
                </div>

                {error && <div style={errBox}>{error}</div>}

                {/* ── Login form ── */}
                {tab === "login" && (
                    <form onSubmit={handleLogin} style={formStyle}>
                        <div>
                            <label style={lbl}>Company Email</label>
                            <input required type="email" placeholder="fleet@company.com"
                                value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} style={inp} />
                        </div>
                        <div>
                            <label style={lbl}>Password</label>
                            <div style={{ position: "relative" }}>
                                <input required type={showPw ? "text" : "password"} placeholder="Your password"
                                    value={loginPw} onChange={(e) => setLoginPw(e.target.value)}
                                    style={{ ...inp, paddingRight: 44 }} />
                                <button type="button" onClick={() => setShowPw((v) => !v)} style={eyeBtn}>
                                    {showPw ? "🙈" : "👁️"}
                                </button>
                            </div>
                        </div>
                        <button type="submit" disabled={loading} style={btnPrimary}>
                            {loading ? "Logging in…" : "Access Dashboard →"}
                        </button>
                    </form>
                )}

                {/* ── Register form ── */}
                {tab === "register" && (
                    <form onSubmit={handleRegister} style={formStyle}>
                        <div style={row}>
                            <Field label="Owner Name" value={form.ownerName} onChange={set("ownerName")} placeholder="Ravi Kumar" />
                            <Field label="Company Name" value={form.companyName} onChange={set("companyName")} placeholder="FastFleet Co." />
                        </div>
                        <div style={row}>
                            <Field label="Phone" type="tel" value={form.phone} onChange={set("phone")} placeholder="9876543210" />
                            <Field label="Email" type="email" value={form.email} onChange={set("email")} placeholder="you@company.com" />
                        </div>
                        <Field label="Address" value={form.address} onChange={set("address")} placeholder="Office/depot address" />
                        <Field label="Total Vehicles" type="number" value={form.totalVehicles} onChange={set("totalVehicles")} placeholder="e.g. 10" style={{ maxWidth: 160 }} />

                        {/* Password section */}
                        <div style={{ marginTop: 4, borderTop: "1px solid #1e2530", paddingTop: 12 }}>
                            <div style={{ fontSize: 11, color: "#555", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
                                🔐 Set Login Password
                            </div>
                            <div style={row}>
                                <div style={grp}>
                                    <label style={lbl}>Password</label>
                                    <input required type="password" placeholder="Min. 6 characters"
                                        value={form.password} onChange={set("password")} style={inp} />
                                </div>
                                <div style={grp}>
                                    <label style={lbl}>Confirm Password</label>
                                    <input required type="password" placeholder="Repeat password"
                                        value={form.confirmPw} onChange={set("confirmPw")} style={inp} />
                                </div>
                            </div>
                        </div>

                        <button type="submit" disabled={loading} style={btnPrimary}>
                            {loading ? "Registering…" : "Register & Enter Dashboard →"}
                        </button>
                    </form>
                )}

                <div style={{ textAlign: "center", marginTop: 20 }}>
                    <button onClick={() => navigate("/")} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 13 }}>
                        ← Back to Home
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ── Simple Field helper ── */
function Field({ label, value, onChange, placeholder, type = "text", style: extra }) {
    return (
        <div style={{ ...grp, ...extra }}>
            <label style={lbl}>{label}</label>
            <input required type={type} placeholder={placeholder} value={value} onChange={onChange} style={inp} />
        </div>
    );
}

/* ── Styles ── */
const page = { minHeight: "100vh", background: "#080c10", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "Inter, sans-serif" };
const card = { background: "#0f1318", border: "1px solid #1e2530", borderRadius: 20, padding: "36px 32px", width: "100%", maxWidth: 520 };
const tabRow = { display: "flex", gap: 8, marginBottom: 20 };
const tabBtn = { flex: 1, padding: "9px 0", background: "#1a1f27", border: "1px solid #1e2530", borderRadius: 10, color: "#666", cursor: "pointer", fontWeight: 600, fontSize: 14 };
const tabActive = { background: "#f6ad55", color: "#000", borderColor: "#f6ad55" };
const formStyle = { display: "flex", flexDirection: "column", gap: 12 };
const lbl = { fontSize: 12, color: "#888", fontWeight: 600, marginBottom: 3, display: "block" };
const inp = { padding: "11px 14px", background: "#1a1f27", border: "1px solid #2a3040", borderRadius: 10, color: "#fff", fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box" };
const row = { display: "flex", gap: 10 };
const grp = { flex: 1, display: "flex", flexDirection: "column" };
const btnPrimary = { marginTop: 4, padding: "13px 0", background: "linear-gradient(135deg,#f6ad55,#ed8936)", color: "#000", fontWeight: 800, fontSize: 15, border: "none", borderRadius: 12, cursor: "pointer" };
const errBox = { background: "#2d1515", border: "1px solid #e53e3e50", color: "#fc8181", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 4 };
const eyeBtn = { position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: 0 };

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const ADMIN_SECRET = "ucab_admin_2026"; // Must match backend .env ADMIN_SECRET

export default function AdminLoginPage() {
    const navigate = useNavigate();
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const handleLogin = (e) => {
        e.preventDefault();
        if (password === ADMIN_SECRET) {
            sessionStorage.setItem("admin_auth", ADMIN_SECRET);
            navigate("/admin/dashboard");
        } else {
            setError("Incorrect admin password. Try again.");
            setPassword("");
        }
    };

    return (
        <div style={page}>
            <div style={card}>
                {/* Logo */}
                <div style={{ textAlign: "center", marginBottom: 28 }}>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>🛡️</div>
                    <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 900, margin: 0 }}>
                        UCab <span style={{ color: "#f6ad55" }}>Admin</span>
                    </h1>
                    <p style={{ color: "#555", fontSize: 13, marginTop: 6 }}>
                        Fleet management control panel
                    </p>
                </div>

                {error && (
                    <div style={errorBox}>{error}</div>
                )}

                <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div>
                        <label style={label}>Admin Password</label>
                        <input
                            type="password"
                            required
                            placeholder="Enter admin password"
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); setError(""); }}
                            style={input}
                        />
                    </div>
                    <button type="submit" style={btn}>
                        Login as Admin →
                    </button>
                </form>

                <p style={{ color: "#333", fontSize: 12, textAlign: "center", marginTop: 20 }}>
                    This panel is for administrators only.<br />
                    Fleet owners log in at{" "}
                    <span
                        style={{ color: "#f6ad55", cursor: "pointer" }}
                        onClick={() => navigate("/login/fleet")}
                    >
                        /login/fleet
                    </span>
                </p>
            </div>
        </div>
    );
}

/* ── Styles ── */
const page = {
    minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
    background: "linear-gradient(135deg, #080c10 0%, #0d1520 100%)",
    fontFamily: "Inter, system-ui, sans-serif",
};
const card = {
    width: "100%", maxWidth: 380, background: "#0f1318",
    border: "1px solid #1e2530", borderRadius: 20, padding: "36px 32px",
    boxShadow: "0 20px 60px #000a",
};
const label = { display: "block", color: "#666", fontSize: 12, fontWeight: 600, marginBottom: 6 };
const input = {
    width: "100%", padding: "11px 14px", background: "#1a1f27",
    border: "1px solid #2a3040", borderRadius: 10, color: "#fff",
    fontSize: 14, outline: "none", boxSizing: "border-box",
};
const btn = {
    padding: "12px", background: "#f6ad55", color: "#000",
    border: "none", borderRadius: 10, fontSize: 15, fontWeight: 800,
    cursor: "pointer", marginTop: 4,
};
const errorBox = {
    background: "#2d1515", border: "1px solid #e53e3e40", borderRadius: 8,
    padding: "10px 14px", color: "#fc8181", fontSize: 13, marginBottom: 12,
};

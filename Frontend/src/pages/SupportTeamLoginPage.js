import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import BACKEND_URL from "../config";
import { THEME } from "../theme";

export default function SupportTeamLoginPage() {
    const navigate = useNavigate();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const response = await axios.post(`${BACKEND_URL}/api/support-team/login`, {
                username: username.trim(),
                password,
            });

            localStorage.setItem("support_team_token", response.data.token);
            localStorage.setItem("support_team", JSON.stringify(response.data.team));

            navigate("/support/dashboard");
        } catch (err) {
            setError(err.response?.data?.error || "Login failed. Check credentials.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.page}>
            {/* Background gradients */}
            <div style={styles.bgGradient1} />
            <div style={styles.bgGradient2} />

            {/* Back button */}
            <button
                onClick={() => navigate("/")}
                style={styles.backButton}
                onMouseEnter={(e) => {
                    e.target.style.background = "rgba(255, 255, 255, 0.1)";
                }}
                onMouseLeave={(e) => {
                    e.target.style.background = "rgba(255, 255, 255, 0.05)";
                }}
            >
                ← Back
            </button>

            {/* Login container */}
            <div style={styles.container}>
                <div style={styles.card}>
                    {/* Header */}
                    <div style={styles.header}>
                        <h1 style={styles.title}>💬 Support Team Portal</h1>
                        <p style={styles.subtitle}>Access the customer support dashboard</p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleLogin} style={styles.form}>
                        {/* Error message */}
                        {error && (
                            <div style={styles.errorBox}>
                                <span>⚠️ {error}</span>
                            </div>
                        )}

                        {/* Demo credentials hint */}
                        <div style={styles.hintBox}>
                            <span style={styles.hintText}>📝 Demo: username=<strong>test</strong>, password=<strong>test</strong></span>
                        </div>

                        {/* Username field */}
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Username</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Enter your username"
                                style={styles.input}
                                disabled={loading}
                            />
                        </div>

                        {/* Password field */}
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Password</label>
                            <div style={styles.passwordWrapper}>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    style={styles.input}
                                    disabled={loading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={styles.toggleButton}
                                >
                                    {showPassword ? "👁" : "👁‍🗨"}
                                </button>
                            </div>
                        </div>

                        {/* Login button */}
                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                ...styles.loginButton,
                                opacity: loading ? 0.7 : 1,
                                cursor: loading ? "not-allowed" : "pointer",
                            }}
                        >
                            {loading ? "🔄 Logging in..." : "✓ Login"}
                        </button>
                    </form>

                    {/* Footer */}
                    <div style={styles.footer}>
                        <p style={styles.footerText}>🔒 Secure access only for authorized support team members</p>
                    </div>
                </div>
            </div>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { font-family: 'Inter', sans-serif; overflow-x: hidden; }
            `}</style>
        </div>
    );
}

const styles = {
    page: {
        minHeight: "100vh",
        background: "linear-gradient(135deg, #080c10 0%, #0f1419 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        fontFamily: "'Inter', sans-serif",
    },
    bgGradient1: {
        position: "absolute",
        width: "500px",
        height: "500px",
        background: "radial-gradient(circle, rgba(255, 193, 7, 0.1) 0%, transparent 70%)",
        top: "-200px",
        left: "-200px",
        borderRadius: "50%",
    },
    bgGradient2: {
        position: "absolute",
        width: "600px",
        height: "600px",
        background: "radial-gradient(circle, rgba(0, 208, 132, 0.08) 0%, transparent 70%)",
        bottom: "-300px",
        right: "-250px",
        borderRadius: "50%",
    },
    backButton: {
        position: "absolute",
        top: "30px",
        left: "30px",
        background: "rgba(255, 255, 255, 0.05)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        color: "#fff",
        padding: "10px 20px",
        borderRadius: "8px",
        cursor: "pointer",
        fontSize: "14px",
        fontWeight: "500",
        transition: "all 0.3s ease",
        backdropFilter: "blur(10px)",
    },
    container: {
        width: "100%",
        maxWidth: "450px",
        padding: "20px",
        display: "flex",
        justifyContent: "center",
    },
    card: {
        background: "rgba(15, 20, 25, 0.8)",
        border: "1px solid rgba(255, 193, 7, 0.2)",
        borderRadius: "16px",
        padding: "40px",
        backdropFilter: "blur(12px)",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
        animation: "slideUp 0.6s ease-out",
    },
    header: {
        textAlign: "center",
        marginBottom: "30px",
    },
    title: {
        color: "#fff",
        fontSize: "28px",
        fontWeight: "700",
        marginBottom: "8px",
    },
    subtitle: {
        color: "rgba(255, 255, 255, 0.6)",
        fontSize: "14px",
        fontWeight: "400",
    },
    form: {
        display: "flex",
        flexDirection: "column",
        gap: "16px",
    },
    errorBox: {
        background: "rgba(244, 67, 54, 0.15)",
        border: "1px solid rgba(244, 67, 54, 0.3)",
        color: "#ff6b6b",
        padding: "12px",
        borderRadius: "8px",
        fontSize: "13px",
        fontWeight: "500",
        marginBottom: "8px",
        animation: "slideInUp 0.3s ease",
    },
    hintBox: {
        background: "rgba(255, 193, 7, 0.1)",
        border: "1px solid rgba(255, 193, 7, 0.2)",
        padding: "12px",
        borderRadius: "8px",
        marginBottom: "8px",
    },
    hintText: {
        color: "rgba(255, 193, 7, 0.8)",
        fontSize: "12px",
        fontWeight: "500",
    },
    formGroup: {
        display: "flex",
        flexDirection: "column",
        gap: "8px",
    },
    label: {
        color: "rgba(255, 255, 255, 0.8)",
        fontSize: "13px",
        fontWeight: "600",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
    },
    input: {
        background: "rgba(255, 255, 255, 0.05)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        color: "#fff",
        padding: "12px 14px",
        borderRadius: "8px",
        fontSize: "14px",
        outline: "none",
        transition: "all 0.3s ease",
    },
    passwordWrapper: {
        position: "relative",
        display: "flex",
        alignItems: "center",
    },
    toggleButton: {
        position: "absolute",
        right: "12px",
        background: "none",
        border: "none",
        color: "rgba(255, 255, 255, 0.6)",
        cursor: "pointer",
        fontSize: "16px",
        padding: "4px 8px",
        transition: "color 0.3s ease",
    },
    loginButton: {
        background: "linear-gradient(135deg, #ffc107 0%, #ffb300 100%)",
        color: "#000",
        border: "none",
        padding: "14px",
        borderRadius: "8px",
        fontSize: "15px",
        fontWeight: "600",
        cursor: "pointer",
        transition: "all 0.3s ease",
        marginTop: "12px",
        boxShadow: "0 4px 15px rgba(255, 193, 7, 0.2)",
    },
    footer: {
        textAlign: "center",
        marginTop: "20px",
        paddingTop: "20px",
        borderTop: "1px solid rgba(255, 255, 255, 0.1)",
    },
    footerText: {
        color: "rgba(255, 255, 255, 0.5)",
        fontSize: "12px",
        fontWeight: "400",
    },
};

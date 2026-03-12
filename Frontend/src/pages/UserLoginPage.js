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

  // Email OTP 2FA state
  const [otpStep, setOtpStep] = useState(false);   // show OTP input step
  const [otpCode, setOtpCode] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpMsg, setOtpMsg] = useState("");
  const [otpCountdown, setOtpCountdown] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Start countdown timer
  const startCountdown = (seconds) => {
    setOtpCountdown(seconds);
    const t = setInterval(() => {
      setOtpCountdown((c) => {
        if (c <= 1) { clearInterval(t); return 0; }
        return c - 1;
      });
    }, 1000);
  };

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

  // Step 1: Send OTP to email (called when email is provided and not yet verified)
  const handleSendOtp = async () => {
    if (!email.trim()) return setError("Enter your email to receive a verification code");
    setError(""); setOtpLoading(true); setOtpMsg("");
    try {
      await axios.post(`${BACKEND_URL}/api/auth/user/send-otp`, { email: email.trim() });
      setOtpStep(true);
      setOtpMsg("✅ OTP sent! Check your inbox (and spam folder).");
      startCountdown(600); // 10 minutes
    } catch (e) {
      setError(e.response?.data?.message || "Failed to send OTP");
    } finally { setOtpLoading(false); }
  };

  // Step 2: Verify the OTP
  const handleVerifyOtp = async () => {
    if (!otpCode.trim()) return setOtpMsg("Enter the 6-digit code");
    setOtpLoading(true); setOtpMsg("");
    try {
      await axios.post(`${BACKEND_URL}/api/auth/user/verify-otp`, {
        email: email.trim(), otp: otpCode.trim()
      });
      setOtpVerified(true);
      setOtpStep(false);
      setOtpMsg("✅ Email verified!");
    } catch (e) {
      setOtpMsg(e.response?.data?.message || "Invalid or expired OTP");
    } finally { setOtpLoading(false); }
  };

  // Step 3: Complete registration (only after OTP verified if email given)
  const handleRegister = async () => {
    if (!phone.trim()) return setError("Phone number is required");
    if (!name.trim()) return setError("Your name is required");
    if (password && password !== confirmPassword) return setError("Passwords do not match");
    // If email provided and not yet verified, require OTP first
    if (email.trim() && !otpVerified) {
      return setError("Please verify your email with the OTP before registering");
    }
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
              onClick={() => { setMode(m); setError(""); setOtpStep(false); setOtpVerified(false); setOtpMsg(""); }}
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

        {/* ── Email + OTP verification (register only) ── */}
        {!isLogin && (
          <div className="input-group">
            <label>
              📧 Email{" "}
              {otpVerified
                ? <span style={{ color: "#00c853", fontWeight: 700 }}>✅ Verified</span>
                : <span style={{ color: "#888" }}>(recommended — enables 2FA)</span>}
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <input type="email" placeholder="you@example.com"
                value={email} onChange={(e) => { setEmail(e.target.value); setOtpVerified(false); setOtpStep(false); }}
                style={{ flex: 1 }}
                disabled={otpVerified} />
              {email.trim() && !otpVerified && (
                <button type="button" onClick={handleSendOtp} disabled={otpLoading || otpCountdown > 0}
                  style={{
                    background: "#1565c0", color: "#fff", border: "none", borderRadius: 8,
                    padding: "0 14px", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", fontSize: 12,
                  }}>
                  {otpLoading ? "…" : otpCountdown > 0 ? `${otpCountdown}s` : "Send OTP"}
                </button>
              )}
            </div>
            {otpMsg && (
              <div style={{ fontSize: 12, marginTop: 6, color: otpMsg.startsWith("✅") ? "#00c853" : "#e53935" }}>
                {otpMsg}
              </div>
            )}

            {/* OTP input */}
            {otpStep && !otpVerified && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 12, color: "#aaa", marginBottom: 6 }}>
                  Enter the 6-digit code sent to {email}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text" inputMode="numeric" maxLength={6}
                    placeholder="123456"
                    value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                    style={{
                      flex: 1, background: "#1a1a2e", border: "2px solid #1565c0",
                      borderRadius: 8, padding: "10px 14px", color: "#fff", fontSize: 22,
                      letterSpacing: 6, fontWeight: 800, textAlign: "center",
                    }} />
                  <button type="button" onClick={handleVerifyOtp} disabled={otpLoading || otpCode.length < 6}
                    style={{
                      background: "#00c853", color: "#fff", border: "none", borderRadius: 8,
                      padding: "0 16px", fontWeight: 700, cursor: "pointer",
                    }}>
                    {otpLoading ? "…" : "Verify"}
                  </button>
                </div>
              </div>
            )}
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
          {loading ? "Please wait…" : isLogin ? "Let's Go 🚖" : "Create Account 🎉"}
        </button>

        <div className="login-switch-link">
          Are you a captain?{" "}
          <Link to="/login/captain">Login here →</Link>
        </div>
      </div>
    </div>
  );
}

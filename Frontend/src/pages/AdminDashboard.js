import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Button, Card, Badge, Alert } from "../components/UIKit";
import { THEME } from "../theme";
import BACKEND_URL from "../config";
import "./AdminDashboardStyles.css";

const ADMIN_SECRET = "ucab_admin_2026";
const headers = { "x-admin-secret": ADMIN_SECRET };

const STATUS_COLOR = {
  completed: "#1db954", accepted: "#3b82f6", pending: "#f6ad55",
  cancelled: "#e53935", started: "#60a5fa",
};

function StatCard({ icon, label, value, color }) {
  return (
    <div style={{ background: "#111", border: "1px solid #222", borderRadius: 14, padding: "18px 20px", flex: 1, minWidth: 130 }}>
      <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 26, fontWeight: 900, color: color || "#eee" }}>{value ?? "—"}</div>
      <div style={{ fontSize: 12, color: "#666", marginTop: 3 }}>{label}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("overview");
  const [stats, setStats] = useState(null);
  const [rides, setRides] = useState([]);
  const [captains, setCaptains] = useState([]);
  const [users, setUsers] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [surge, setSurge] = useState({ multiplier: 1, autoSurge: true });
  const [surgeInput, setSurgeInput] = useState("1");
  const [ticketNotes, setTicketNotes] = useState({});
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // Auth guard
  useEffect(() => {
    if (sessionStorage.getItem("admin_auth") !== ADMIN_SECRET) {
      navigate("/admin/login");
    }
  }, [navigate]);

  const fetchStats = useCallback(async () => {
    const res = await axios.get(`${BACKEND_URL}/api/admin/stats`, { headers });
    setStats(res.data);
  }, []);

  const fetchTab = useCallback(async (t) => {
    setLoading(true);
    try {
      if (t === "overview") await fetchStats();
      else if (t === "rides") { const r = await axios.get(`${BACKEND_URL}/api/admin/rides`, { headers }); setRides(r.data.rides || []); }
      else if (t === "captains") { const r = await axios.get(`${BACKEND_URL}/api/admin/captains`, { headers }); setCaptains(r.data.captains || []); }
      else if (t === "users") { const r = await axios.get(`${BACKEND_URL}/api/admin/users`, { headers }); setUsers(r.data.users || []); }
      else if (t === "tickets") { const r = await axios.get(`${BACKEND_URL}/api/admin/support-tickets`, { headers }); setTickets(r.data.tickets || []); }
      else if (t === "withdrawals") { const r = await axios.get(`${BACKEND_URL}/api/admin/withdrawals`, { headers }); setWithdrawals(r.data.withdrawals || []); }
      else if (t === "surge") { const r = await axios.get(`${BACKEND_URL}/api/admin/surge`, { headers }); setSurge(r.data); setSurgeInput(String(r.data.multiplier)); }
    } catch (e) {
      setMsg(e.response?.data?.error || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [fetchStats]);

  useEffect(() => { fetchTab(tab); }, [tab, fetchTab]);

  const showMsg = (m) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  const verifyCaptain = async (id, verified) => {
    await axios.patch(`${BACKEND_URL}/api/admin/captains/${id}/verify`, { verified }, { headers });
    setCaptains((prev) => prev.map((c) => c.id === id ? { ...c, is_verified: verified } : c));
    showMsg(verified ? "✅ Captain verified" : "Captain unverified");
  };

  const banCaptain = async (id) => {
    await axios.patch(`${BACKEND_URL}/api/admin/captains/${id}/ban`, {}, { headers });
    setCaptains((prev) => prev.map((c) => c.id === id ? { ...c, is_verified: false } : c));
    showMsg("🚫 Captain banned");
  };

  const updateTicket = async (id, status) => {
    const adminNote = ticketNotes[id] || "";
    await axios.patch(`${BACKEND_URL}/api/admin/support-tickets/${id}`, { status, adminNote }, { headers });
    setTickets((prev) => prev.map((t) => t.id === id ? { ...t, status, admin_note: adminNote } : t));
    showMsg("✅ Ticket updated");
  };

  const handleWithdrawal = async (id, action) => {
    await axios.patch(`${BACKEND_URL}/api/admin/withdrawals/${id}`, { action }, { headers });
    setWithdrawals((prev) => prev.filter((w) => w.id !== id));
    showMsg(`✅ Withdrawal ${action}`);
  };

  const saveSurge = async () => {
    const m = parseFloat(surgeInput);
    if (isNaN(m) || m < 1 || m > 5) { showMsg("Multiplier must be between 1 and 5"); return; }
    await axios.patch(`${BACKEND_URL}/api/admin/surge`, { multiplier: m, autoSurge: surge.autoSurge }, { headers });
    setSurge((s) => ({ ...s, multiplier: m }));
    showMsg("✅ Surge settings saved");
  };

  const logout = () => { sessionStorage.removeItem("admin_auth"); navigate("/admin/login"); };

  const tabs = [
    { id: "overview", label: "📊 Overview" },
    { id: "rides", label: "🚗 Rides" },
    { id: "captains", label: "👤 Captains" },
    { id: "users", label: "👥 Users" },
    { id: "tickets", label: "🎫 Support" },
    { id: "withdrawals", label: "💸 Withdrawals" },
    { id: "surge", label: "⚡ Surge" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#eee", fontFamily: "'Inter', sans-serif" }}>

      {/* Header */}
      <div style={{ padding: "14px 24px", background: "#0f1318", borderBottom: "1px solid #1e2530", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>🛡️ UCab <span style={{ color: "#f6ad55" }}>Admin</span></div>
        {msg && <div style={{ marginLeft: 16, fontSize: 13, color: msg.startsWith("✅") ? "#1db954" : "#e53935", background: msg.startsWith("✅") ? "#0d2818" : "#1a0000", padding: "5px 12px", borderRadius: 8 }}>{msg}</div>}
        <button onClick={logout} style={{ marginLeft: "auto", padding: "7px 14px", background: "#1a0000", border: "1px solid #e53935", borderRadius: 8, color: "#e53935", fontSize: 13, cursor: "pointer", fontWeight: 700 }}>Logout</button>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, padding: "8px 16px", background: "#0f1318", borderBottom: "1px solid #1e2530", overflowX: "auto" }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer", whiteSpace: "nowrap", fontWeight: tab === t.id ? 700 : 500, fontSize: 13, background: tab === t.id ? "#1db954" : "transparent", color: tab === t.id ? "#000" : "#888", transition: "all 0.15s" }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: 20, maxWidth: 1100, margin: "0 auto" }}>

        {loading && <div style={{ textAlign: "center", padding: 40, color: "#555" }}>Loading…</div>}

        {/* ─── Overview ─── */}
        {!loading && tab === "overview" && stats && (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
              <StatCard icon="🚗" label="Total Rides" value={stats.ridesTotal} />
              <StatCard icon="📅" label="Rides Today" value={stats.ridesToday} color="#3b82f6" />
              <StatCard icon="💰" label="Revenue Today" value={`₹${stats.revenueToday || 0}`} color="#1db954" />
              <StatCard icon="👤" label="Active Captains" value={stats.activeCaptains} color="#f6ad55" />
              <StatCard icon="👥" label="Total Users" value={stats.totalUsers} />
              <StatCard icon="🎫" label="Pending Tickets" value={stats.pendingTickets} color="#e53935" />
              <StatCard icon="💸" label="Pending Payouts" value={stats.pendingWithdrawals} color="#f6ad55" />
            </div>
            <div style={{ color: "#444", fontSize: 12, textAlign: "center" }}>Auto-refreshes on tab switch · Admin panel v1.0</div>
          </>
        )}

        {/* ─── Rides ─── */}
        {!loading && tab === "rides" && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #222", color: "#666" }}>
                  {["Status", "Rider", "Captain", "Pickup", "Dropoff", "Fare", "Type", "Date"].map((h) => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rides.map((r) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid #181818" }}>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ background: STATUS_COLOR[r.status] + "22", color: STATUS_COLOR[r.status] || "#888", padding: "3px 8px", borderRadius: 6, fontWeight: 700, fontSize: 11 }}>{r.status}</span>
                    </td>
                    <td style={{ padding: "10px 12px", color: "#ccc" }}>{r.rider_name || "—"}</td>
                    <td style={{ padding: "10px 12px", color: "#ccc" }}>{r.captain_name || "—"}</td>
                    <td style={{ padding: "10px 12px", color: "#888", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.pickup?.address || "—"}</td>
                    <td style={{ padding: "10px 12px", color: "#888", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.dropoff?.address || "—"}</td>
                    <td style={{ padding: "10px 12px", color: "#1db954", fontWeight: 700 }}>₹{r.fare}</td>
                    <td style={{ padding: "10px 12px", color: "#888" }}>{r.ride_type}</td>
                    <td style={{ padding: "10px 12px", color: "#555", whiteSpace: "nowrap" }}>{r.created_at ? new Date(r.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true }) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rides.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#444" }}>No rides found</div>}
          </div>
        )}

        {/* ─── Captains ─── */}
        {!loading && tab === "captains" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {captains.map((c) => (
              <div key={c.id} style={{ background: "#111", border: "1px solid #222", borderRadius: 14, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                {c.photo_url ? (
                  <img src={c.photo_url} alt="" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", border: "2px solid #1db954" }} />
                ) : (
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#1db954", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18, color: "#000" }}>{c.name?.[0]?.toUpperCase() || "C"}</div>
                )}
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#eee" }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: "#666" }}>{c.phone} · {c.vehicle?.type} · {c.vehicle?.plate}</div>
                  <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>⭐ {c.rating || "—"} · {c.total_rides || 0} rides</div>
                </div>
                <span style={{ padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700, background: c.is_verified ? "#0d2818" : "#1a0000", color: c.is_verified ? "#1db954" : "#e53935" }}>
                  {c.is_verified ? "✅ Verified" : "⏳ Unverified"}
                </span>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button onClick={() => verifyCaptain(c.id, !c.is_verified)} style={{ padding: "7px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: c.is_verified ? "#1a0800" : "#0d2818", color: c.is_verified ? "#f6ad55" : "#1db954" }}>
                    {c.is_verified ? "Unverify" : "Verify"}
                  </button>
                  <button onClick={() => { if (window.confirm(`Ban ${c.name}?`)) banCaptain(c.id); }} style={{ padding: "7px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: "#1a0000", color: "#e53935" }}>
                    Ban
                  </button>
                </div>
              </div>
            ))}
            {captains.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#444" }}>No captains found</div>}
          </div>
        )}

        {/* ─── Users ─── */}
        {!loading && tab === "users" && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #222", color: "#666" }}>
                  {["Name", "Phone", "Email", "Joined"].map((h) => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderBottom: "1px solid #181818" }}>
                    <td style={{ padding: "10px 12px", color: "#eee", fontWeight: 600 }}>{u.name}</td>
                    <td style={{ padding: "10px 12px", color: "#ccc" }}>{u.phone}</td>
                    <td style={{ padding: "10px 12px", color: "#888" }}>{u.email || "—"}</td>
                    <td style={{ padding: "10px 12px", color: "#555" }}>{u.created_at ? new Date(u.created_at).toLocaleDateString("en-IN") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#444" }}>No users found</div>}
          </div>
        )}

        {/* ─── Support Tickets ─── */}
        {!loading && tab === "tickets" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {tickets.map((t) => (
              <div key={t.id} style={{ background: "#111", border: "1px solid #222", borderRadius: 14, padding: "16px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: "#eee" }}>{t.subject || "Support Request"}</span>
                  <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: t.status === "open" ? "#1a0000" : "#0d2818", color: t.status === "open" ? "#e53935" : "#1db954" }}>{t.status}</span>
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "#555" }}>{t.created_at ? new Date(t.created_at).toLocaleDateString("en-IN") : ""}</span>
                </div>
                <div style={{ fontSize: 13, color: "#aaa", marginBottom: 10 }}>{t.message}</div>
                {t.admin_note && <div style={{ fontSize: 12, color: "#f6ad55", background: "#1a1200", padding: "6px 10px", borderRadius: 8, marginBottom: 10 }}>📝 Admin note: {t.admin_note}</div>}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <input
                    placeholder="Admin note…"
                    value={ticketNotes[t.id] || ""}
                    onChange={(e) => setTicketNotes((p) => ({ ...p, [t.id]: e.target.value }))}
                    style={{ flex: 1, minWidth: 200, padding: "8px 12px", background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, color: "#fff", fontSize: 12, outline: "none" }}
                  />
                  {["in_review", "resolved", "closed"].map((s) => (
                    <button key={s} onClick={() => updateTicket(t.id, s)} style={{ padding: "8px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: s === "resolved" ? "#0d2818" : "#1a1a1a", color: s === "resolved" ? "#1db954" : "#ccc" }}>
                      {s.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {tickets.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#444" }}>No support tickets</div>}
          </div>
        )}

        {/* ─── Withdrawals ─── */}
        {!loading && tab === "withdrawals" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {withdrawals.map((w) => (
              <div key={w.id} style={{ background: "#111", border: "1px solid #222", borderRadius: 14, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#1db954" }}>₹{w.amount}</div>
                  <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{w.captain_name || w.captain_id} · {w.created_at ? new Date(w.created_at).toLocaleDateString("en-IN") : ""}</div>
                  {w.upi_id && <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>UPI: {w.upi_id}</div>}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => handleWithdrawal(w.id, "approved")} style={{ padding: "9px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, background: "#0d2818", color: "#1db954" }}>✅ Approve</button>
                  <button onClick={() => handleWithdrawal(w.id, "rejected")} style={{ padding: "9px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, background: "#1a0000", color: "#e53935" }}>❌ Reject</button>
                </div>
              </div>
            ))}
            {withdrawals.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#444" }}>No pending withdrawals</div>}
          </div>
        )}

        {/* ─── Surge Settings ─── */}
        {!loading && tab === "surge" && (
          <div style={{ maxWidth: 480 }}>
            <div style={{ background: "#111", border: "1px solid #222", borderRadius: 14, padding: 24 }}>
              <div style={{ fontWeight: 800, fontSize: 17, color: "#f6ad55", marginBottom: 6 }}>⚡ Surge Pricing</div>
              <div style={{ fontSize: 13, color: "#666", marginBottom: 20 }}>Manually override surge multiplier or let it auto-calculate from demand.</div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 6, fontWeight: 600 }}>MULTIPLIER (1.0 – 5.0)</label>
                <input
                  type="number" min="1" max="5" step="0.1"
                  value={surgeInput}
                  onChange={(e) => setSurgeInput(e.target.value)}
                  style={{ width: "100%", padding: "12px 14px", background: "#1a1a1a", border: "1.5px solid #333", borderRadius: 10, color: "#fff", fontSize: 20, fontWeight: 700, outline: "none", boxSizing: "border-box" }}
                />
                <input type="range" min="1" max="5" step="0.1" value={surgeInput} onChange={(e) => setSurgeInput(e.target.value)}
                  style={{ width: "100%", marginTop: 10, accentColor: "#f6ad55" }} />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <label style={{ fontSize: 13, color: "#ccc" }}>Auto-surge (based on real-time demand/supply)</label>
                <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                  <input type="checkbox" checked={surge.autoSurge} onChange={(e) => setSurge((s) => ({ ...s, autoSurge: e.target.checked }))} style={{ width: 18, height: 18, accentColor: "#1db954", cursor: "pointer" }} />
                </label>
              </div>

              <button onClick={saveSurge} style={{ width: "100%", padding: 14, background: "#f6ad55", border: "none", borderRadius: 12, color: "#000", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
                Save Surge Settings
              </button>

              <div style={{ marginTop: 16, textAlign: "center", fontSize: 13, color: "#666" }}>
                Current active multiplier: <span style={{ color: "#f6ad55", fontWeight: 800 }}>{surge.multiplier}x</span>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

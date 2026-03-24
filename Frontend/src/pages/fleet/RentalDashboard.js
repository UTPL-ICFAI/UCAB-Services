import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import BACKEND_URL from "../../config";

export default function RentalDashboard() {
    const navigate = useNavigate();
    // Support both storage keys
    const owner = JSON.parse(
        localStorage.getItem("rental_provider") ||
        localStorage.getItem("fleet_owner") ||
        "null"
    );

    const [vehicles, setVehicles] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState("Overview");
    const [showAddVehicle, setShowAddVehicle] = useState(false);
    const [vForm, setVForm] = useState({
        vehicleType: "Car", vehicleNumber: "", driverName: "", driverPhone: "", seatingCapacity: ""
    });
    const [vMsg, setVMsg] = useState(null);
    const [toast, setToast] = useState("");

    useEffect(() => {
        if (!owner) { navigate("/login/rental"); return; }
    });

    const fetchData = useCallback(async () => {
        if (!owner?._id) return;
        setLoading(true);
        try {
            const [vRes, bRes] = await Promise.all([
                axios.get(`${BACKEND_URL}/api/fleet/vehicles?ownerId=${owner._id}`),
                axios.get(`${BACKEND_URL}/api/fleet/bookings`),
            ]);
            setVehicles(vRes.data.vehicles || []);
            setBookings(bRes.data.bookings || []);
        } catch (_) { }
        setLoading(false);
    }, [owner?._id]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const logout = () => {
        localStorage.removeItem("rental_provider");
        localStorage.removeItem("fleet_owner");
        navigate("/");
    };

    const addVehicle = async (e) => {
        e.preventDefault(); setVMsg(null);
        try {
            await axios.post(`${BACKEND_URL}/api/fleet/vehicles`, {
                ownerId: owner._id,
                ...vForm,
                seatingCapacity: Number(vForm.seatingCapacity),
            });
            setVMsg({ type: "success", text: "Vehicle added successfully!" });
            setVForm({ vehicleType: "Car", vehicleNumber: "", driverName: "", driverPhone: "", seatingCapacity: "" });
            fetchData();
        } catch (err) {
            setVMsg({ type: "error", text: err.response?.data?.message || "Failed to add vehicle" });
        }
    };

    const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

    const pendingBookings = bookings.filter((b) => b.status === "pending");
    const available = vehicles.filter((v) => v.isAvailable).length;

    return (
        <div style={page}>
            {/* Top bar */}
            <div style={topbar}>
                <div style={{ fontWeight: 900, fontSize: 20, color: "#fff" }}>
                    Uride <span style={{ color: "#f6ad55" }}>Rentals</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ color: "#aaa", fontSize: 13 }}>🏢 {owner?.companyName || owner?.ownerName}</span>
                    <button onClick={logout} style={logoutBtn}>Logout</button>
                </div>
            </div>

            {toast && (
                <div style={{
                    position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
                    background: "#00c853", color: "#fff", borderRadius: 12, padding: "10px 24px",
                    fontWeight: 700, zIndex: 999,
                }}>{toast}</div>
            )}

            <div style={content}>
                {/* Tabs */}
                <div style={tabBar}>
                    {["Overview", "Vehicles", "Bookings"].map((t) => (
                        <button key={t} onClick={() => setTab(t)}
                            style={{ ...tabBtn, ...(tab === t ? tabActive : {}) }}>
                            {t}
                        </button>
                    ))}
                </div>

                {/* ── Overview ── */}
                {tab === "Overview" && (
                    <div>
                        <div style={grid}>
                            <StatCard label="Total Fleet" value={vehicles.length} icon="🚗" />
                            <StatCard label="Available" value={available} icon="✅" />
                            <StatCard label="Booked Out" value={vehicles.length - available} icon="📋" />
                            <StatCard label="Pending Requests" value={pendingBookings.length} icon="⏳" color="#f6ad55" />
                        </div>
                        <div style={{ marginTop: 24 }}>
                            <h3 style={{ color: "#fff", margin: "0 0 12px" }}>📋 Recent Bookings</h3>
                            {bookings.slice(0, 5).map((b) => (
                                <div key={b._id || b.id} style={bookingCard}>
                                    <div style={{ color: "#fff", fontWeight: 700 }}>{b.clientName || "—"}</div>
                                    <div style={{ color: "#aaa", fontSize: 12 }}>
                                        {b.vehicleType} · {b.startDate ? new Date(b.startDate).toLocaleDateString() : "—"}
                                        <span style={{
                                            marginLeft: 8,
                                            color: b.status === "confirmed" ? "#00c853" : b.status === "pending" ? "#f6ad55" : "#e53935",
                                            fontWeight: 600,
                                        }}>● {b.status}</span>
                                    </div>
                                </div>
                            ))}
                            {!bookings.length && <div style={{ color: "#555", fontSize: 13 }}>No bookings yet</div>}
                        </div>
                    </div>
                )}

                {/* ── Vehicles ── */}
                {tab === "Vehicles" && (
                    <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                            <h3 style={{ color: "#fff", margin: 0 }}>Your Fleet</h3>
                            <button onClick={() => setShowAddVehicle((v) => !v)} style={addBtn}>
                                {showAddVehicle ? "✕ Cancel" : "+ Add Vehicle"}
                            </button>
                        </div>

                        {showAddVehicle && (
                            <form onSubmit={addVehicle} style={formCard}>
                                <h4 style={{ color: "#fff", margin: "0 0 12px" }}>Add New Vehicle</h4>
                                <div style={fieldRow}>
                                    <label style={lbl}>Type</label>
                                    <select value={vForm.vehicleType}
                                        onChange={(e) => setVForm({ ...vForm, vehicleType: e.target.value })}
                                        style={inp}>
                                        {["Car", "SUV", "Bus", "Bike"].map((t) => (
                                            <option key={t}>{t}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={fieldRow}>
                                    <label style={lbl}>Vehicle Number</label>
                                    <input required value={vForm.vehicleNumber} placeholder="KA01AB1234"
                                        onChange={(e) => setVForm({ ...vForm, vehicleNumber: e.target.value })} style={inp} />
                                </div>
                                <div style={fieldRow}>
                                    <label style={lbl}>Driver Name</label>
                                    <input value={vForm.driverName} placeholder="(optional)"
                                        onChange={(e) => setVForm({ ...vForm, driverName: e.target.value })} style={inp} />
                                </div>
                                <div style={fieldRow}>
                                    <label style={lbl}>Driver Phone</label>
                                    <input value={vForm.driverPhone} placeholder="(optional)"
                                        onChange={(e) => setVForm({ ...vForm, driverPhone: e.target.value })} style={inp} />
                                </div>
                                <div style={fieldRow}>
                                    <label style={lbl}>Seats</label>
                                    <input required type="number" min="1" max="50" value={vForm.seatingCapacity}
                                        placeholder="4" onChange={(e) => setVForm({ ...vForm, seatingCapacity: e.target.value })} style={inp} />
                                </div>
                                {vMsg && <div style={{ color: vMsg.type === "success" ? "#00c853" : "#e53935", fontSize: 13, margin: "8px 0" }}>{vMsg.text}</div>}
                                <button type="submit" style={addBtn}>Add Vehicle →</button>
                            </form>
                        )}

                        {loading ? (
                            <div style={{ color: "#555", padding: 24 }}>Loading…</div>
                        ) : vehicles.length === 0 ? (
                            <div style={{ color: "#555", textAlign: "center", padding: 32 }}>No vehicles yet. Add your first one above.</div>
                        ) : (
                            vehicles.map((v) => (
                                <div key={v._id || v.id} style={vehicleCard}>
                                    <div style={{ color: "#fff", fontWeight: 700 }}>
                                        {v.vehicleType} · {v.vehicleNumber}
                                    </div>
                                    <div style={{ color: "#aaa", fontSize: 12 }}>
                                        {v.driverName ? `👤 ${v.driverName}` : "No driver"} ·
                                        {" "}{v.seatingCapacity} seats ·{" "}
                                        <span style={{ color: v.isAvailable ? "#00c853" : "#e53935", fontWeight: 600 }}>
                                            {v.isAvailable ? "Available" : "Booked"}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* ── Bookings ── */}
                {tab === "Bookings" && (
                    <div>
                        <h3 style={{ color: "#fff", margin: "0 0 16px" }}>All Bookings</h3>
                        {loading ? (
                            <div style={{ color: "#555" }}>Loading…</div>
                        ) : bookings.length === 0 ? (
                            <div style={{ color: "#555", textAlign: "center", padding: 32 }}>No bookings yet.</div>
                        ) : (
                            bookings.map((b) => (
                                <div key={b._id || b.id} style={bookingCard}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                        <div>
                                            <div style={{ color: "#fff", fontWeight: 700 }}>{b.clientName || "Unknown"}</div>
                                            <div style={{ color: "#aaa", fontSize: 12, marginTop: 4 }}>
                                                {b.vehicleType} · {b.startDate ? new Date(b.startDate).toLocaleDateString() : "—"} →{" "}
                                                {b.endDate ? new Date(b.endDate).toLocaleDateString() : "—"}
                                            </div>
                                            {b.clientPhone && <div style={{ color: "#888", fontSize: 12 }}>📞 {b.clientPhone}</div>}
                                        </div>
                                        <span style={{
                                            padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                                            background: b.status === "confirmed" ? "#00c853" : b.status === "pending" ? "#f6ad55" : "#e53935",
                                            color: "#fff",
                                        }}>{b.status}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

const StatCard = ({ label, value, icon, color = "#00c853" }) => (
    <div style={{
        background: "#1a2035", borderRadius: 12, padding: "16px 20px",
        border: "1px solid #1e2530", textAlign: "center",
    }}>
        <div style={{ fontSize: 28 }}>{icon}</div>
        <div style={{ fontSize: 28, fontWeight: 900, color }}>{value}</div>
        <div style={{ color: "#888", fontSize: 12 }}>{label}</div>
    </div>
);

// ── Styles ──────────────────────────────────────────────────
const page = {
    minHeight: "100vh", background: "#0d1117", fontFamily: "Inter,sans-serif",
};
const topbar = {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    background: "#161b22", padding: "14px 24px",
    borderBottom: "1px solid #1e2530",
};
const content = { padding: "24px 20px", maxWidth: 800, margin: "0 auto" };
const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 12 };
const tabBar = { display: "flex", gap: 8, marginBottom: 24 };
const tabBtn = {
    padding: "8px 18px", border: "none", borderRadius: 8, cursor: "pointer",
    fontWeight: 600, fontSize: 13, background: "#1a2035", color: "#aaa",
};
const tabActive = { background: "#00c853", color: "#fff" };
const bookingCard = {
    background: "#161b22", border: "1px solid #1e2530", borderRadius: 10,
    padding: "14px 16px", marginBottom: 10,
};
const vehicleCard = {
    background: "#161b22", border: "1px solid #1e2530", borderRadius: 10,
    padding: "14px 16px", marginBottom: 10,
};
const formCard = {
    background: "#161b22", border: "1px solid #1e2530", borderRadius: 12,
    padding: "20px", marginBottom: 20,
};
const fieldRow = { marginBottom: 12 };
const lbl = { color: "#aaa", fontSize: 12, marginBottom: 4, display: "block" };
const inp = {
    width: "100%", background: "#0d1117", border: "1px solid #1e2530",
    borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: 14, boxSizing: "border-box",
};
const addBtn = {
    background: "#00c853", color: "#fff", border: "none", borderRadius: 8,
    padding: "8px 18px", fontWeight: 700, cursor: "pointer",
};
const logoutBtn = {
    background: "transparent", border: "1px solid #333", color: "#aaa",
    borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 12,
};

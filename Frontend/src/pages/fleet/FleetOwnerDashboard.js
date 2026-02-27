import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import BACKEND_URL from "../../config";

const TABS = ["Overview", "Vehicles", "Bookings"];

export default function FleetOwnerDashboard() {
    const navigate = useNavigate();
    const owner = JSON.parse(localStorage.getItem("fleet_owner") || "null");
    const [tab, setTab] = useState("Overview");
    const [vehicles, setVehicles] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddVehicle, setShowAddVehicle] = useState(false);
    const [vForm, setVForm] = useState({ vehicleType: "Car", vehicleNumber: "", driverName: "", driverPhone: "", seatingCapacity: "" });
    const [vMsg, setVMsg] = useState(null);

    useEffect(() => {
        if (!owner) { navigate("/login/fleet"); return; }
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

    const logout = () => { localStorage.removeItem("fleet_owner"); navigate("/"); };

    const addVehicle = async (e) => {
        e.preventDefault(); setVMsg(null);
        try {
            await axios.post(`${BACKEND_URL}/api/fleet/vehicles`, {
                ownerId: owner._id,
                ...vForm,
                seatingCapacity: Number(vForm.seatingCapacity),
            });
            setVMsg({ type: "success", text: "Vehicle added!" });
            setVForm({ vehicleType: "Car", vehicleNumber: "", driverName: "", driverPhone: "", seatingCapacity: "" });
            fetchData();
        } catch (err) {
            setVMsg({ type: "error", text: err.response?.data?.message || "Failed to add vehicle" });
        }
    };

    const available = vehicles.filter((v) => v.isAvailable).length;
    const unavailable = vehicles.length - available;
    const pendingB = bookings.filter((b) => b.status === "pending").length;

    return (
        <div style={page}>
            {/* Top bar */}
            <div style={topbar}>
                <div style={{ fontWeight: 900, fontSize: 20, color: "#fff" }}>
                    UCab <span style={{ color: "#f6ad55" }}>Fleet</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ color: "#888", fontSize: 13 }}>👤 {owner?.ownerName}</span>
                    <button onClick={logout} style={logoutBtn}>Logout</button>
                </div>
            </div>

            <div style={content}>
                {/* Welcome */}
                <div style={{ marginBottom: 24 }}>
                    <h2 style={{ color: "#fff", fontWeight: 800, fontSize: 22, margin: 0 }}>
                        Welcome back, {owner?.ownerName?.split(" ")[0]} 👋
                    </h2>
                    <p style={{ color: "#666", marginTop: 4, fontSize: 13 }}>{owner?.companyName}</p>
                </div>

                {/* Stats */}
                <div style={statsGrid}>
                    {[
                        { icon: "🚗", label: "Total Vehicles", val: vehicles.length, color: "#4299e1" },
                        { icon: "🟢", label: "Available", val: available, color: "#1db954" },
                        { icon: "🔴", label: "On Duty", val: unavailable, color: "#e53e3e" },
                        { icon: "📋", label: "Pending Bookings", val: pendingB, color: "#f6ad55" },
                    ].map((s) => (
                        <div key={s.label} style={statCard}>
                            <div style={{ fontSize: 28 }}>{s.icon}</div>
                            <div style={{ color: s.color, fontWeight: 800, fontSize: 26 }}>{s.val}</div>
                            <div style={{ color: "#666", fontSize: 12 }}>{s.label}</div>
                        </div>
                    ))}
                </div>

                {/* Tabs */}
                <div style={tabRow}>
                    {TABS.map((t) => (
                        <button key={t} onClick={() => setTab(t)} style={{ ...tabBtn, ...(tab === t ? tabActive : {}) }}>
                            {t}
                        </button>
                    ))}
                </div>

                {loading && <div style={{ color: "#555", textAlign: "center", padding: 32 }}>Loading…</div>}

                {/* ── Overview tab ── */}
                {!loading && tab === "Overview" && (
                    <div style={sectionBox}>
                        <h3 style={sectionTitle}>Company Info</h3>
                        {[
                            ["Company", owner?.companyName],
                            ["Email", owner?.email],
                            ["Phone", owner?.phone],
                            ["Address", owner?.address],
                            ["Fleet Size", owner?.totalVehicles + " vehicles"],
                        ].map(([k, v]) => (
                            <div key={k} style={infoRow}>
                                <span style={{ color: "#666", fontSize: 13 }}>{k}</span>
                                <span style={{ color: "#ccc", fontSize: 13, fontWeight: 600 }}>{v}</span>
                            </div>
                        ))}

                        {/* Read-only verified status — only admin can change this */}
                        <div style={{ ...infoRow, alignItems: "center" }}>
                            <span style={{ color: "#666", fontSize: 13 }}>Verified</span>
                            {owner?.isVerified
                                ? <span style={{ color: "#1db954", fontWeight: 700, fontSize: 13 }}>✅ Verified</span>
                                : (
                                    <span style={{ color: "#f6ad55", fontSize: 13, fontWeight: 600 }}>
                                        ⏳ Pending — awaiting admin approval
                                    </span>
                                )}
                        </div>
                    </div>
                )}

                {/* ── Vehicles tab ── */}
                {!loading && tab === "Vehicles" && (
                    <>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                            <h3 style={{ ...sectionTitle, margin: 0 }}>My Vehicles ({vehicles.length})</h3>
                            <button onClick={() => setShowAddVehicle((v) => !v)} style={addBtn}>
                                {showAddVehicle ? "Cancel" : "+ Add Vehicle"}
                            </button>
                        </div>

                        {/* Add vehicle inline form */}
                        {showAddVehicle && (
                            <div style={{ ...sectionBox, marginBottom: 16 }}>
                                <h4 style={{ color: "#f6ad55", marginBottom: 12, fontSize: 14 }}>Add New Vehicle</h4>
                                {vMsg && <div style={{ ...msgBox, background: vMsg.type === "success" ? "#0d2212" : "#2d1515", borderColor: vMsg.type === "success" ? "#1db954" : "#e53e3e", color: vMsg.type === "success" ? "#1db954" : "#fc8181" }}>{vMsg.text}</div>}
                                <form onSubmit={addVehicle} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    <div style={{ display: "flex", gap: 10 }}>
                                        {["Car", "Bus", "Van"].map((t) => (
                                            <label key={t} style={{ display: "flex", alignItems: "center", gap: 6, color: "#aaa", fontSize: 13, cursor: "pointer" }}>
                                                <input type="radio" value={t} checked={vForm.vehicleType === t} onChange={(e) => setVForm({ ...vForm, vehicleType: e.target.value })} />
                                                {t === "Car" ? "🚗 Car" : t === "Bus" ? "🚌 Bus" : "🚐 Van"}
                                            </label>
                                        ))}
                                    </div>
                                    <div style={{ display: "flex", gap: 10 }}>
                                        <input required placeholder="Vehicle Number (e.g. TN01AB1234)" value={vForm.vehicleNumber}
                                            onChange={(e) => setVForm({ ...vForm, vehicleNumber: e.target.value.toUpperCase() })} style={dinp} />
                                        <input required type="number" min="1" placeholder="Seats" value={vForm.seatingCapacity}
                                            onChange={(e) => setVForm({ ...vForm, seatingCapacity: e.target.value })} style={{ ...dinp, maxWidth: 80 }} />
                                    </div>
                                    <div style={{ display: "flex", gap: 10 }}>
                                        <input required placeholder="Driver Name" value={vForm.driverName}
                                            onChange={(e) => setVForm({ ...vForm, driverName: e.target.value })} style={dinp} />
                                        <input required type="tel" placeholder="Driver Phone" value={vForm.driverPhone}
                                            onChange={(e) => setVForm({ ...vForm, driverPhone: e.target.value })} style={dinp} />
                                    </div>
                                    <button type="submit" style={{ ...addBtn, background: "#f6ad55", color: "#000", padding: "10px 0", borderRadius: 10, fontWeight: 700 }}>
                                        Add Vehicle →
                                    </button>
                                </form>
                            </div>
                        )}

                        {vehicles.length === 0 ? (
                            <div style={empty}>🚗<br />No vehicles registered yet</div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {vehicles.map((v) => (
                                    <div key={v._id} style={vehicleCard}>
                                        <div style={{ fontSize: 28 }}>{v.vehicleType === "Car" ? "🚗" : v.vehicleType === "Bus" ? "🚌" : "🚐"}</div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>{v.vehicleNumber}</div>
                                            <div style={{ color: "#888", fontSize: 12, marginTop: 2 }}>Driver: {v.driverName} · {v.driverPhone}</div>
                                            <div style={{ color: "#888", fontSize: 12 }}>{v.vehicleType} · {v.seatingCapacity} seats</div>
                                        </div>
                                        <span style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: v.isAvailable ? "#1db95420" : "#e53e3e20", color: v.isAvailable ? "#1db954" : "#fc8181" }}>
                                            {v.isAvailable ? "Available" : "On Duty"}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {/* ── Bookings tab ── */}
                {!loading && tab === "Bookings" && (
                    <>
                        <h3 style={sectionTitle}>All Bookings ({bookings.length})</h3>
                        {bookings.length === 0 ? (
                            <div style={empty}>📋<br />No bookings yet</div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {bookings.map((b) => (
                                    <div key={b._id} style={bookingCard}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                            <div>
                                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                    <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>{b.clientName}</span>
                                                    {b.bookingType && b.bookingType !== "NORMAL" && (
                                                        <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: "#4299e120", color: "#63b3ed" }}>
                                                            {b.bookingType === "DRIVER_ONLY" ? "🧑‍✈️ Driver Only" : "🚗 Vehicle Only"}
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ color: "#888", fontSize: 12, marginTop: 2 }}>{b.clientType} · {b.vehicleType} × {b.numVehicles}</div>
                                            </div>
                                            <StatusPill status={b.status} />
                                        </div>
                                        <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
                                            <div>📍 {b.pickupLocation} → {b.dropLocation}</div>
                                            <div style={{ marginTop: 4 }}>📅 {new Date(b.date).toLocaleDateString("en-IN")}</div>
                                            {b.calculatedFare != null && (
                                                <div style={{ marginTop: 4, color: "#f6ad55", fontWeight: 600 }}>💰 ₹{b.calculatedFare}</div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

const StatusPill = ({ status }) => {
    const colors = { pending: "#f6ad55", confirmed: "#1db954", cancelled: "#e53e3e" };
    return (
        <span style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${colors[status] || "#888"}20`, color: colors[status] || "#888", textTransform: "capitalize" }}>
            {status}
        </span>
    );
};

/* ── Styles ── */
const page = { minHeight: "100vh", background: "#080c10", fontFamily: "Inter, sans-serif" };
const topbar = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", background: "#0f1318", borderBottom: "1px solid #1e2530", position: "sticky", top: 0, zIndex: 10 };
const content = { maxWidth: 860, margin: "0 auto", padding: "28px 20px" };
const statsGrid = { display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 24 };
const statCard = { flex: 1, minWidth: 130, background: "#0f1318", border: "1px solid #1e2530", borderRadius: 14, padding: "18px 16px", display: "flex", flexDirection: "column", gap: 4, alignItems: "center" };
const tabRow = { display: "flex", gap: 8, marginBottom: 16 };
const tabBtn = { padding: "8px 18px", background: "#1a1f27", border: "1px solid #1e2530", borderRadius: 10, color: "#666", cursor: "pointer", fontWeight: 600, fontSize: 13 };
const tabActive = { background: "#f6ad55", color: "#000", borderColor: "#f6ad55" };
const sectionBox = { background: "#0f1318", border: "1px solid #1e2530", borderRadius: 14, padding: "16px 18px", marginBottom: 16 };
const sectionTitle = { color: "#f6ad55", fontWeight: 700, fontSize: 14, marginBottom: 12 };
const infoRow = { display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #1e2530" };
const vehicleCard = { display: "flex", alignItems: "center", gap: 14, background: "#0f1318", border: "1px solid #1e2530", borderRadius: 12, padding: "14px 16px" };
const bookingCard = { background: "#0f1318", border: "1px solid #1e2530", borderRadius: 12, padding: "14px 16px" };
const logoutBtn = { padding: "7px 14px", background: "#e53e3e20", border: "1px solid #e53e3e40", borderRadius: 8, color: "#fc8181", cursor: "pointer", fontSize: 12, fontWeight: 600 };
const addBtn = { padding: "8px 16px", background: "#f6ad5520", border: "1px solid #f6ad5540", borderRadius: 8, color: "#f6ad55", cursor: "pointer", fontSize: 13, fontWeight: 700 };
const empty = { color: "#444", textAlign: "center", padding: "48px 0", fontSize: 14, lineHeight: 2 };
const dinp = { padding: "9px 12px", background: "#1a1f27", border: "1px solid #2a3040", borderRadius: 8, color: "#fff", fontSize: 13, outline: "none", width: "100%" };
const msgBox = { border: "1px solid", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 10 };

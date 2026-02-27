import React, { useState, useEffect } from "react";
import axios from "axios";
import BACKEND_URL from "../../config";
import { FleetStyles } from "./FleetOwnerRegister";

// ─────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────
const VEHICLE_TYPES = ["Car", "Bus", "Van"];
const CLIENT_TYPES = ["Company", "School", "Other"];

const BOOKING_MODES = [
    { key: "NORMAL", label: "🚗 Normal", sub: "Driver + Vehicle assigned" },
    { key: "DRIVER_ONLY", label: "🧑‍✈️ Driver Only", sub: "Bring your own vehicle — billed hourly" },
    { key: "VEHICLE_ONLY", label: "🚐 Vehicle Only", sub: "Bring your own driver — billed daily" },
];

// ─────────────────────────────────────────────
//  Sub-component: PricingPreview
//  Read-only fare estimate panel.
// ─────────────────────────────────────────────
function PricingPreview({ mode, rates, durationHours, durationDays }) {
    if (!rates) return null;

    let label = "";
    let detail = "";
    let total = null;

    if (mode === "NORMAL") {
        label = "Estimated Fare (Auto-calculated)";
        detail = `Distance-based · ₹${rates.normalPerKm}/km`;
        total = `~₹${rates.normalPerKm * rates.normalEstimatedKm}`;
    } else if (mode === "DRIVER_ONLY") {
        label = "Pricing (billed hourly)";
        detail = `₹${rates.hourlyRate}/hr`;
        const hrs = Number(durationHours);
        if (hrs > 0) total = `₹${rates.hourlyRate * hrs}`;
    } else if (mode === "VEHICLE_ONLY") {
        label = "Pricing (billed daily)";
        detail = `₹${rates.dailyRate}/day`;
        const days = Number(durationDays);
        if (days > 0) total = `₹${rates.dailyRate * days}`;
    }

    return (
        <div style={{
            background: "#0a1a10",
            border: "1px solid #1db95440",
            borderRadius: 10,
            padding: "12px 16px",
            margin: "14px 0 6px",
        }}>
            <div style={{ color: "#f6ad55", fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                💰 {label}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#888", fontSize: 13 }}>{detail}</span>
                {total && (
                    <span style={{ color: "#1db954", fontWeight: 700, fontSize: 15 }}>
                        ✅ {total}
                    </span>
                )}
            </div>
            <div style={{ fontSize: 11, color: "#555", marginTop: 5 }}>
                Final amount is confirmed after booking &amp; calculated by our system.
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
//  Sub-component: CommonFields
//  Shared across all booking types.
// ─────────────────────────────────────────────
function CommonFields({ form, set }) {
    return (
        <>
            <div className="fleet-row">
                <div className="fleet-group">
                    <label>Organisation / Client Name</label>
                    <input required placeholder="ABC School" value={form.clientName} onChange={set("clientName")} />
                </div>
                <div className="fleet-group">
                    <label>Client Type</label>
                    <select value={form.clientType} onChange={set("clientType")}>
                        {CLIENT_TYPES.map((t) => <option key={t}>{t}</option>)}
                    </select>
                </div>
            </div>

            <div className="fleet-row">
                <div className="fleet-group">
                    <label>Phone</label>
                    <input required type="tel" placeholder="9999900000" value={form.clientPhone} onChange={set("clientPhone")} />
                </div>
                <div className="fleet-group">
                    <label>Email</label>
                    <input required type="email" placeholder="contact@org.com" value={form.clientEmail} onChange={set("clientEmail")} />
                </div>
            </div>
        </>
    );
}

// ─────────────────────────────────────────────
//  Sub-component: DriverOnlySection
//  Hourly hire — customer brings their own vehicle.
// ─────────────────────────────────────────────
function DriverOnlySection({
    durationHours, setDurationHours,
    cvMake, setCvMake,
    cvModel, setCvModel,
    cvPlate, setCvPlate,
    cvYear, setCvYear,
    purpose, setPurpose,
}) {
    return (
        <>
            {/* Duration */}
            <div className="fleet-group fleet-group-sm">
                <label>Duration (hours) *</label>
                <input
                    required type="number" min="1" max="24"
                    placeholder="e.g. 4"
                    value={durationHours}
                    onChange={(e) => setDurationHours(e.target.value)}
                />
            </div>

            {/* Customer's own vehicle */}
            <div style={{ margin: "14px 0 6px", color: "#f6ad55", fontWeight: 700, fontSize: 13 }}>
                🚗 Your Vehicle Details
            </div>
            <div className="fleet-row">
                <div className="fleet-group">
                    <label>Vehicle Brand *</label>
                    <input required placeholder="e.g. Toyota" value={cvMake} onChange={(e) => setCvMake(e.target.value)} />
                </div>
                <div className="fleet-group">
                    <label>Model *</label>
                    <input required placeholder="e.g. Innova" value={cvModel} onChange={(e) => setCvModel(e.target.value)} />
                </div>
            </div>
            <div className="fleet-row">
                <div className="fleet-group">
                    <label>Vehicle Number *</label>
                    <input
                        required placeholder="e.g. KA01AB1234"
                        value={cvPlate}
                        onChange={(e) => setCvPlate(e.target.value.toUpperCase())}
                    />
                </div>
                <div className="fleet-group">
                    <label>Year (optional)</label>
                    <input type="number" placeholder="e.g. 2020" value={cvYear} onChange={(e) => setCvYear(e.target.value)} />
                </div>
            </div>

            {/* Optional purpose */}
            <div className="fleet-group">
                <label>Purpose of Service (optional)</label>
                <input
                    placeholder="e.g. Airport pickup, Business meeting…"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                />
            </div>
        </>
    );
}

// ─────────────────────────────────────────────
//  Sub-component: VehicleOnlySection
//  Daily rental — customer provides their own driver.
// ─────────────────────────────────────────────
function VehicleOnlySection({ durationDays, setDurationDays, vehicleType, setVehicleType }) {
    return (
        <>
            <div className="fleet-row">
                <div className="fleet-group">
                    <label>Vehicle Type *</label>
                    <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
                        {VEHICLE_TYPES.map((t) => <option key={t}>{t}</option>)}
                    </select>
                </div>
                <div className="fleet-group">
                    <label>Rental Duration (days) *</label>
                    <input
                        required type="number" min="1"
                        placeholder="e.g. 3"
                        value={durationDays}
                        onChange={(e) => setDurationDays(e.target.value)}
                    />
                </div>
            </div>

            {/* Security deposit informational note */}
            <div style={{
                background: "#1a1400",
                border: "1px solid #f6ad5540",
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: 12,
                color: "#aaa",
                marginTop: 6,
            }}>
                ℹ️ <b style={{ color: "#f6ad55" }}>Security Deposit:</b> A refundable security deposit
                may be collected at the time of vehicle handover. Amount varies by vehicle type.
            </div>
        </>
    );
}

// ─────────────────────────────────────────────
//  Main Page
// ─────────────────────────────────────────────
const FORM_DEFAULTS = {
    clientName: "", clientPhone: "", clientEmail: "",
    clientType: "Company",
    pickupLocation: "", dropLocation: "", date: "",
};

export default function FleetBookingPage() {
    const [mode, setMode] = useState("NORMAL");
    const [form, setForm] = useState(FORM_DEFAULTS);
    const [rates, setRates] = useState(null);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState(null);
    const [booked, setBooked] = useState(null);

    // NORMAL — no extra state needed
    // VEHICLE_ONLY
    const [vehicleType, setVehicleType] = useState("Car");
    const [numVehicles] = useState(1);
    const [durationDays, setDurationDays] = useState("");

    // DRIVER_ONLY
    const [durationHours, setDurationHours] = useState("");
    const [cvMake, setCvMake] = useState("");
    const [cvModel, setCvModel] = useState("");
    const [cvPlate, setCvPlate] = useState("");
    const [cvYear, setCvYear] = useState("");
    const [purpose, setPurpose] = useState("");

    // Fetch server-side rates on mount for the read-only pricing preview
    useEffect(() => {
        axios.get(`${BACKEND_URL}/api/fleet/rates`)
            .then((res) => setRates(res.data))
            .catch(() => {
                // Fallback display values if fetch fails
                setRates({ hourlyRate: 150, dailyRate: 1200, normalPerKm: 12, normalEstimatedKm: 20 });
            });
    }, []);

    const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

    const switchMode = (m) => {
        setMode(m);
        setMsg(null);
        setBooked(null);
    };

    const resetExtras = () => {
        setDurationHours(""); setDurationDays("");
        setCvMake(""); setCvModel(""); setCvPlate(""); setCvYear(""); setPurpose("");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true); setMsg(null); setBooked(null);
        try {
            const base = { ...form, bookingType: mode };
            let payload;

            if (mode === "NORMAL") {
                payload = {
                    ...base,
                    vehicleType,
                    numVehicles,
                };
            } else if (mode === "DRIVER_ONLY") {
                payload = {
                    ...base,
                    durationHours: Number(durationHours),
                    customerVehicleDetails: {
                        make: cvMake,
                        model: cvModel,
                        plate: cvPlate.toUpperCase(),
                        year: cvYear ? Number(cvYear) : undefined,
                    },
                    purpose: purpose || undefined,
                };
            } else {
                // VEHICLE_ONLY
                payload = {
                    ...base,
                    vehicleType,
                    durationDays: Number(durationDays),
                };
            }

            const res = await axios.post(`${BACKEND_URL}/api/fleet/bookings/v2`, payload);
            setMsg({ type: "success", text: res.data.message });
            setBooked(res.data);
            setForm(FORM_DEFAULTS);
            resetExtras();
        } catch (err) {
            setMsg({ type: "error", text: err.response?.data?.message || "Booking failed" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fleet-page">
            <h2>🗓️ Book Fleet Services</h2>
            <p className="fleet-sub">Choose a booking type, then fill in the details</p>

            {/* ── Mode selector ── */}
            <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
                {BOOKING_MODES.map((m) => (
                    <button
                        key={m.key}
                        onClick={() => switchMode(m.key)}
                        style={{
                            flex: 1, minWidth: 140, padding: "12px 14px",
                            background: mode === m.key ? "#f6ad5520" : "#1a1f27",
                            border: `2px solid ${mode === m.key ? "#f6ad55" : "#2a3040"}`,
                            borderRadius: 12, cursor: "pointer", textAlign: "center",
                            transition: "all 0.2s",
                        }}
                    >
                        <div style={{ fontSize: 15, fontWeight: 700, color: mode === m.key ? "#f6ad55" : "#aaa" }}>
                            {m.label}
                        </div>
                        <div style={{ fontSize: 11, color: "#666", marginTop: 3 }}>{m.sub}</div>
                    </button>
                ))}
            </div>

            {/* ── Alerts ── */}
            {msg && <div className={`fleet-msg fleet-${msg.type}`}>{msg.text}</div>}

            {/* ── Success summary ── */}
            {booked && (
                <div className="fleet-booking-summary">
                    <h4>✅ Booking Confirmed</h4>
                    <p><b>Booking ID:</b> {booked.booking._id}</p>
                    <p><b>Type:</b> {booked.booking.bookingType}</p>
                    {booked.assignedDriver && (
                        <p><b>Driver:</b> {booked.assignedDriver.name} · ⭐ {booked.assignedDriver.rating}</p>
                    )}
                    {booked.assignedVehicle && (
                        <p><b>Vehicle:</b> {booked.assignedVehicle.vehicleNumber} ({booked.assignedVehicle.vehicleType})</p>
                    )}
                    <p style={{ color: "#1db954", fontWeight: 700 }}>
                        <b>Confirmed Fare:</b> ₹{booked.calculatedFare}
                    </p>
                </div>
            )}

            {/* ── Form ── */}
            <form className="fleet-form" onSubmit={handleSubmit}>

                {/* Common fields — always shown */}
                <CommonFields form={form} set={set} />

                {/* ── NORMAL: pickup/drop + vehicle prefs ── */}
                {mode === "NORMAL" && (
                    <>
                        <div className="fleet-row">
                            <div className="fleet-group">
                                <label>Vehicle Type</label>
                                <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
                                    {VEHICLE_TYPES.map((t) => <option key={t}>{t}</option>)}
                                </select>
                            </div>
                            <div className="fleet-group">
                                <label>Number of Vehicles</label>
                                <input
                                    required type="number" min="1"
                                    placeholder="e.g. 1"
                                    defaultValue={1}
                                    onChange={(e) => { /* handled via payload */ }}
                                />
                            </div>
                        </div>
                    </>
                )}

                {/* Pickup / Drop — shown for all modes */}
                <div className="fleet-group">
                    <label>Pickup Location</label>
                    <input required placeholder="e.g. Anna Nagar, Chennai" value={form.pickupLocation} onChange={set("pickupLocation")} />
                </div>
                <div className="fleet-group">
                    <label>Drop Location</label>
                    <input required placeholder="e.g. Chennai Airport" value={form.dropLocation} onChange={set("dropLocation")} />
                </div>

                {/* Date */}
                <div className="fleet-group fleet-group-sm">
                    <label>Date of Travel</label>
                    <input
                        required type="date"
                        min={new Date().toISOString().split("T")[0]}
                        value={form.date} onChange={set("date")}
                    />
                </div>

                {/* ── DRIVER_ONLY section ── */}
                {mode === "DRIVER_ONLY" && (
                    <DriverOnlySection
                        durationHours={durationHours} setDurationHours={setDurationHours}
                        cvMake={cvMake} setCvMake={setCvMake}
                        cvModel={cvModel} setCvModel={setCvModel}
                        cvPlate={cvPlate} setCvPlate={setCvPlate}
                        cvYear={cvYear} setCvYear={setCvYear}
                        purpose={purpose} setPurpose={setPurpose}
                    />
                )}

                {/* ── VEHICLE_ONLY section ── */}
                {mode === "VEHICLE_ONLY" && (
                    <VehicleOnlySection
                        durationDays={durationDays} setDurationDays={setDurationDays}
                        vehicleType={vehicleType} setVehicleType={setVehicleType}
                    />
                )}

                {/* ── Pricing preview (read-only) — always shown ── */}
                <PricingPreview
                    mode={mode}
                    rates={rates}
                    durationHours={durationHours}
                    durationDays={durationDays}
                />

                <button className="btn-primary" type="submit" disabled={loading}>
                    {loading
                        ? "Booking…"
                        : mode === "DRIVER_ONLY"
                            ? "Confirm Driver-Only Booking →"
                            : mode === "VEHICLE_ONLY"
                                ? "Confirm Vehicle-Only Booking →"
                                : "Confirm Normal Booking →"}
                </button>
            </form>

            <style>{`
        .fleet-booking-summary { background:#0d2212; border:1px solid #1db95440; border-radius:12px; padding:16px 18px; margin-bottom:18px; }
        .fleet-booking-summary h4 { margin:0 0 10px; color:#1db954; font-size:15px; }
        .fleet-booking-summary p  { margin:4px 0; font-size:.9rem; color:#aaa; }
      `}</style>
            <FleetStyles />
        </div>
    );
}

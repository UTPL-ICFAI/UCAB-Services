import React, { useState } from "react";
import axios from "axios";
import BACKEND_URL from "../../config";
import { FleetStyles } from "./FleetOwnerRegister";

const VEHICLE_TYPES = ["Car", "Bus", "Van"];

export default function FleetVehicleRegister() {
    const [form, setForm] = useState({
        ownerId: "", vehicleType: "Car", vehicleNumber: "",
        driverName: "", driverPhone: "", seatingCapacity: "",
    });
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState(null);

    const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true); setMsg(null);
        try {
            const res = await axios.post(`${BACKEND_URL}/api/fleet/vehicles`, {
                ...form, seatingCapacity: Number(form.seatingCapacity),
            });
            setMsg({ type: "success", text: res.data.message });
            setForm({ ownerId: "", vehicleType: "Car", vehicleNumber: "", driverName: "", driverPhone: "", seatingCapacity: "" });
        } catch (err) {
            setMsg({ type: "error", text: err.response?.data?.message || "Failed to add vehicle" });
        } finally { setLoading(false); }
    };

    return (
        <div className="fleet-page">
            <h2>🚗 Add Fleet Vehicle</h2>
            <p className="fleet-sub">Register a vehicle under a fleet owner</p>

            {msg && <div className={`fleet-msg fleet-${msg.type}`}>{msg.text}</div>}

            <form className="fleet-form" onSubmit={handleSubmit}>
                <div className="fleet-group">
                    <label>Fleet Owner ID</label>
                    <input required placeholder="Paste Owner _id from registration" value={form.ownerId} onChange={set("ownerId")} />
                </div>

                <div className="fleet-group">
                    <label>Vehicle Type</label>
                    <div style={{ display: "flex", gap: 10 }}>
                        {VEHICLE_TYPES.map((t) => (
                            <label key={t} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontWeight: form.vehicleType === t ? 700 : 400 }}>
                                <input type="radio" value={t} checked={form.vehicleType === t} onChange={set("vehicleType")} />
                                {t === "Car" ? "🚗" : t === "Bus" ? "🚌" : "🚐"} {t}
                            </label>
                        ))}
                    </div>
                </div>

                <div className="fleet-row">
                    <div className="fleet-group">
                        <label>Vehicle Number</label>
                        <input required placeholder="TN01AB1234" value={form.vehicleNumber} onChange={(e) => setForm({ ...form, vehicleNumber: e.target.value.toUpperCase() })} />
                    </div>
                    <div className="fleet-group">
                        <label>Seating Capacity</label>
                        <input required type="number" min="1" placeholder="e.g. 12" value={form.seatingCapacity} onChange={set("seatingCapacity")} />
                    </div>
                </div>

                <div className="fleet-row">
                    <div className="fleet-group">
                        <label>Driver Name</label>
                        <input required placeholder="e.g. Suresh" value={form.driverName} onChange={set("driverName")} />
                    </div>
                    <div className="fleet-group">
                        <label>Driver Phone</label>
                        <input required type="tel" placeholder="9876543210" value={form.driverPhone} onChange={set("driverPhone")} />
                    </div>
                </div>

                <button className="btn-primary" type="submit" disabled={loading}>
                    {loading ? "Adding…" : "Add Vehicle →"}
                </button>
            </form>

            <FleetStyles />
        </div>
    );
}

import React, { useState } from "react";
import axios from "axios";
import BACKEND_URL from "../../config";
import { FleetStyles } from "./FleetOwnerRegister";

const VEHICLE_TYPES = ["Hatchback", "Sedan", "SUV", "Bike", "Car", "Van", "Bus"];

const readFileAsBase64 = (file) =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

export default function FleetVehicleRegister() {
    const [form, setForm] = useState({
        ownerId: "", vehicleType: "Hatchback", vehicleNumber: "",
        vehicleColor: "", driverName: "", driverPhone: "", seatingCapacity: "",
    });
    const [driverAadhaar, setDriverAadhaar] = useState("");
    const [vehicleInsurance, setVehicleInsurance] = useState("");
    const [driverLicense, setDriverLicense] = useState("");
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState(null);

    const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!driverAadhaar) {
            setMsg({ type: "error", text: "Driver Aadhaar card is required" });
            return;
        }
        if (!vehicleInsurance) {
            setMsg({ type: "error", text: "Vehicle insurance certificate is required" });
            return;
        }
        if (!driverLicense) {
            setMsg({ type: "error", text: "Driver licence is required" });
            return;
        }
        setLoading(true); setMsg(null);
        try {
            const res = await axios.post(`${BACKEND_URL}/api/fleet/vehicles`, {
                ...form,
                seatingCapacity: Number(form.seatingCapacity),
                driverAadhaar,
                vehicleInsurance,
                driverLicense,
            });
            setMsg({ type: "success", text: res.data.message });
            setForm({ ownerId: "", vehicleType: "Hatchback", vehicleNumber: "", vehicleColor: "", driverName: "", driverPhone: "", seatingCapacity: "" });
            setDriverAadhaar("");
            setVehicleInsurance("");
            setDriverLicense("");
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
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {VEHICLE_TYPES.map((t) => (
                            <label key={t} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontWeight: form.vehicleType === t ? 700 : 400 }}>
                                <input type="radio" value={t} checked={form.vehicleType === t} onChange={set("vehicleType")} />
                                {t === "Car" || t === "Hatchback" || t === "Sedan" ? "🚗"
                                    : t === "SUV" ? "🚙"
                                    : t === "Bus" ? "🚌"
                                    : t === "Van" ? "🚐"
                                    : "🏍️"} {t}
                            </label>
                        ))}
                    </div>
                </div>

                <div className="fleet-row">
                    <div className="fleet-group">
                        <label>🔖 Number Plate * (mandatory)</label>
                        <input required placeholder="TN01AB1234" value={form.vehicleNumber}
                            onChange={(e) => setForm({ ...form, vehicleNumber: e.target.value.toUpperCase() })} />
                    </div>
                    <div className="fleet-group">
                        <label>🎨 Vehicle Colour * (mandatory)</label>
                        <input required placeholder="e.g. White" value={form.vehicleColor} onChange={set("vehicleColor")} />
                    </div>
                </div>

                <div className="fleet-row">
                    <div className="fleet-group">
                        <label>Seating Capacity</label>
                        <input required type="number" min="1" placeholder="e.g. 5" value={form.seatingCapacity} onChange={set("seatingCapacity")} />
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

                {/* Mandatory Document Upload */}
                <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#c05621", marginBottom: 10 }}>
                        📄 Mandatory Documents
                    </div>
                    <div className="fleet-group" style={{ maxWidth: 340 }}>
                        <label>🛡️ Vehicle Insurance Certificate * (mandatory)</label>
                        <input type="file" accept="image/*,.pdf"
                            onChange={async (e) => {
                                if (e.target.files[0]) setVehicleInsurance(await readFileAsBase64(e.target.files[0]));
                            }} />
                        {vehicleInsurance && <span style={{ fontSize: 11, color: "#276749" }}>✓ Uploaded</span>}
                    </div>
                    <div className="fleet-group" style={{ maxWidth: 340 }}>
                        <label>🪪 Driver Licence * (mandatory)</label>
                        <input type="file" accept="image/*,.pdf"
                            onChange={async (e) => {
                                if (e.target.files[0]) setDriverLicense(await readFileAsBase64(e.target.files[0]));
                            }} />
                        {driverLicense && <span style={{ fontSize: 11, color: "#276749" }}>✓ Uploaded</span>}
                    </div>
                    <div className="fleet-group" style={{ maxWidth: 340 }}>
                        <label>🪪 Driver Aadhaar Card * (mandatory)</label>
                        <input type="file" accept="image/*,.pdf"
                            onChange={async (e) => {
                                if (e.target.files[0]) setDriverAadhaar(await readFileAsBase64(e.target.files[0]));
                            }} />
                        {driverAadhaar && <span style={{ fontSize: 11, color: "#276749" }}>✓ Uploaded</span>}
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

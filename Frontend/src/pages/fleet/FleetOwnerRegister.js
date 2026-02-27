import React, { useState } from "react";
import axios from "axios";
import BACKEND_URL from "../../config";

export default function FleetOwnerRegister() {
    const [form, setForm] = useState({
        ownerName: "", companyName: "", phone: "",
        email: "", address: "", totalVehicles: "",
    });
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState(null);  // { type: 'success'|'error', text }

    const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true); setMsg(null);
        try {
            const res = await axios.post(`${BACKEND_URL}/api/fleet/owners`, {
                ...form, totalVehicles: Number(form.totalVehicles),
            });
            setMsg({ type: "success", text: res.data.message });
            setForm({ ownerName: "", companyName: "", phone: "", email: "", address: "", totalVehicles: "" });
        } catch (err) {
            setMsg({ type: "error", text: err.response?.data?.message || "Registration failed" });
        } finally { setLoading(false); }
    };

    return (
        <div className="fleet-page">
            <h2>🚌 Register Fleet Owner</h2>
            <p className="fleet-sub">Register your company to offer fleet vehicles</p>

            {msg && <div className={`fleet-msg fleet-${msg.type}`}>{msg.text}</div>}

            <form className="fleet-form" onSubmit={handleSubmit}>
                <div className="fleet-row">
                    <div className="fleet-group">
                        <label>Owner Name</label>
                        <input required placeholder="e.g. Ravi Kumar" value={form.ownerName} onChange={set("ownerName")} />
                    </div>
                    <div className="fleet-group">
                        <label>Company Name</label>
                        <input required placeholder="e.g. FastFleet Co." value={form.companyName} onChange={set("companyName")} />
                    </div>
                </div>

                <div className="fleet-row">
                    <div className="fleet-group">
                        <label>Phone</label>
                        <input required type="tel" placeholder="9876543210" value={form.phone} onChange={set("phone")} />
                    </div>
                    <div className="fleet-group">
                        <label>Email</label>
                        <input required type="email" placeholder="company@email.com" value={form.email} onChange={set("email")} />
                    </div>
                </div>

                <div className="fleet-group">
                    <label>Address</label>
                    <input required placeholder="Full address" value={form.address} onChange={set("address")} />
                </div>

                <div className="fleet-group fleet-group-sm">
                    <label>Total Vehicles in Fleet</label>
                    <input required type="number" min="1" placeholder="e.g. 10" value={form.totalVehicles} onChange={set("totalVehicles")} />
                </div>

                <button className="btn-primary" type="submit" disabled={loading}>
                    {loading ? "Registering…" : "Register Fleet Owner →"}
                </button>
            </form>

            <FleetStyles />
        </div>
    );
}

export const FleetStyles = () => (
    <style>{`
    .fleet-page { max-width:640px; margin:32px auto; padding:0 16px; font-family:inherit; }
    .fleet-page h2 { margin:0 0 4px; font-size:1.5rem; }
    .fleet-sub { color:#718096; margin:0 0 20px; font-size:.9rem; }
    .fleet-msg { padding:12px 16px; border-radius:8px; margin-bottom:16px; font-size:.92rem; }
    .fleet-success { background:#f0fff4; border:1px solid #9ae6b4; color:#276749; }
    .fleet-error   { background:#fff5f5; border:1px solid #feb2b2; color:#c53030; }
    .fleet-form { display:flex; flex-direction:column; gap:14px; }
    .fleet-row { display:flex; gap:12px; }
    .fleet-row .fleet-group { flex:1; }
    .fleet-group { display:flex; flex-direction:column; gap:4px; }
    .fleet-group label { font-size:.83rem; font-weight:600; color:#4a5568; }
    .fleet-group input, .fleet-group select { padding:10px 12px; border:1px solid #cbd5e0; border-radius:8px; font-size:.95rem; outline:none; transition:border .15s; }
    .fleet-group input:focus, .fleet-group select:focus { border-color:#4299e1; }
    .fleet-group-sm { max-width:200px; }
    .btn-primary { padding:12px 20px; background:#2b6cb0; color:#fff; border:none; border-radius:10px; font-size:1rem; cursor:pointer; font-weight:600; margin-top:4px; }
    .btn-primary:disabled { opacity:.6; cursor:not-allowed; }
  `}</style>
);

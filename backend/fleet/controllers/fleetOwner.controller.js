const bcrypt = require("bcryptjs");
const FleetOwner = require("../models/fleetOwner.model");

// ── POST /api/fleet/owners  (register) ───────────────────────
const registerOwner = async (req, res) => {
    try {
        const { ownerName, companyName, phone, email, address, totalVehicles, password } = req.body;

        if (!ownerName || !companyName || !phone || !email || !address || !totalVehicles || !password) {
            return res.status(400).json({ message: "All fields including password are required" });
        }
        if (password.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters" });
        }
        if (isNaN(totalVehicles) || Number(totalVehicles) < 1) {
            return res.status(400).json({ message: "totalVehicles must be a positive number" });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Duplicate check (case-insensitive email)
        const existing = await FleetOwner.findOne({
            $or: [{ phone: phone.trim() }, { email: normalizedEmail }]
        });
        if (existing) {
            const field = existing.phone === phone.trim() ? "phone" : "email";
            return res.status(409).json({ message: `A fleet owner with this ${field} already exists` });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const owner = await FleetOwner.create({
            ownerName: ownerName.trim(),
            companyName: companyName.trim(),
            phone: phone.trim(),
            email: normalizedEmail,
            address: address.trim(),
            totalVehicles: Number(totalVehicles),
            password: hashedPassword,
        });

        // Don't return password hash to client
        const { password: _pw, ...safeOwner } = owner.toObject();
        res.status(201).json({ message: "Fleet owner registered successfully", owner: safeOwner });
    } catch (err) {
        console.error("registerOwner error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// ── POST /api/fleet/owners/login  (email + password) ─────────
const loginOwner = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const owner = await FleetOwner.findOne({ email: normalizedEmail });
        if (!owner) {
            return res.status(404).json({ message: "No fleet owner found with this email. Please register first." });
        }

        const isMatch = await bcrypt.compare(password, owner.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Incorrect password" });
        }

        const { password: _pw, ...safeOwner } = owner.toObject();
        res.json({ message: "Login successful", owner: safeOwner });
    } catch (err) {
        console.error("loginOwner error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// ── GET /api/fleet/owners?verified=true ──────────────────────
const getOwners = async (req, res) => {
    try {
        const filter = {};
        if (req.query.verified === "true") filter.isVerified = true;
        const owners = await FleetOwner.find(filter).select("-password").sort({ createdAt: -1 });
        res.json({ owners });
    } catch (err) {
        console.error("getOwners error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// ── PATCH /api/fleet/owners/:id/verify ───────────────────────
const verifyOwner = async (req, res) => {
    try {
        const owner = await FleetOwner.findByIdAndUpdate(
            req.params.id,
            { isVerified: true },
            { new: true }
        ).select("-password");
        if (!owner) return res.status(404).json({ message: "Fleet owner not found" });
        res.json({ message: "Owner verified", owner });
    } catch (err) {
        console.error("verifyOwner error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = { registerOwner, loginOwner, getOwners, verifyOwner };

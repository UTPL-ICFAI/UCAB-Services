const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Captain = require("../models/Captain");
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "ucab_secret_2026";

// ── Helper: sign token ──────────────────────────────────────
const signToken = (payload) =>
    jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });

// ============================================================
//  USER — Login / Register with phone number only
// ============================================================
router.post("/user/login", async (req, res) => {
    try {
        const { phone, name } = req.body;
        if (!phone) return res.status(400).json({ message: "Phone is required" });

        let user = await User.findOne({ phone });
        if (!user) {
            // Auto-register — use provided name or generate one from phone
            const displayName = name?.trim() || `Rider ${phone.slice(-4)}`;
            user = await User.create({ phone, name: displayName });
        }

        const token = signToken({ id: user._id, role: "user" });
        res.json({
            token,
            user: { _id: user._id, name: user.name, phone: user.phone, role: "user" }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// ============================================================
//  CAPTAIN — Register
// ============================================================
router.post("/captain/register", async (req, res) => {
    try {
        const { name, phone, password, vehicle } = req.body;
        if (!name || !phone || !password || !vehicle)
            return res.status(400).json({ message: "All fields are required" });
        if (!vehicle.type || !vehicle.plate || !vehicle.color || !vehicle.model)
            return res.status(400).json({ message: "Vehicle details incomplete" });

        const existing = await Captain.findOne({ phone });
        if (existing)
            return res.status(409).json({ message: "Phone already registered" });

        const captain = await Captain.create({ name, phone, password, vehicle });
        const token = signToken({ id: captain._id, role: "captain" });

        res.status(201).json({
            token,
            captain: {
                _id: captain._id,
                name: captain.name,
                phone: captain.phone,
                vehicle: captain.vehicle,
                rating: captain.rating,
                earnings: captain.earnings,
                totalRides: captain.totalRides,
                role: "captain"
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// ============================================================
//  CAPTAIN — Login
// ============================================================
router.post("/captain/login", async (req, res) => {
    try {
        const { phone, password } = req.body;
        if (!phone || !password)
            return res.status(400).json({ message: "Phone and password required" });

        const captain = await Captain.findOne({ phone });
        if (!captain)
            return res.status(404).json({ message: "Captain not found" });

        const match = await captain.comparePassword(password);
        if (!match)
            return res.status(401).json({ message: "Wrong password" });

        const token = signToken({ id: captain._id, role: "captain" });
        res.json({
            token,
            captain: {
                _id: captain._id,
                name: captain.name,
                phone: captain.phone,
                vehicle: captain.vehicle,
                rating: captain.rating,
                earnings: captain.earnings,
                totalRides: captain.totalRides,
                role: "captain"
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// ============================================================
//  CAPTAIN — Update earnings after completing ride
// ============================================================
router.post("/captain/complete-ride", async (req, res) => {
    try {
        const { captainId, fare } = req.body;
        const captain = await Captain.findByIdAndUpdate(
            captainId,
            { $inc: { earnings: fare, totalRides: 1 } },
            { new: true }
        );
        res.json({ earnings: captain.earnings, totalRides: captain.totalRides });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;

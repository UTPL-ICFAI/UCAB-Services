const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Captain = require("../models/Captain");
const pool = require("../config/db");
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "ucab_secret_2026";

// ── Helper: sign token ──────────────────────────────────────
const signToken = (payload) =>
    jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });

// ============================================================
//  USER — Login / Register (phone + optional email/password)
// ============================================================
router.post("/user/login", async (req, res) => {
    try {
        const { phone, name, email, password } = req.body;
        if (!phone) return res.status(400).json({ message: "Phone is required" });

        let user = await User.findOne({ phone });
        if (!user) {
            // Auto-register with whatever info was provided
            const displayName = name?.trim() || `Rider ${phone.slice(-4)}`;
            user = await User.create({
                phone,
                name: displayName,
                email: email?.trim() || null,
                password: password?.trim() || null,
            });
        } else if (password) {
            // Returning user provided a password — verify it if one is stored
            if (user.hasPassword) {
                const match = await user.comparePassword(password);
                if (!match) return res.status(401).json({ message: "Wrong password" });
            }
        }

        const token = signToken({ id: user._id, role: "user" });
        res.json({
            token,
            user: { _id: user._id, name: user.name, phone: user.phone, email: user.email, role: "user" }
        });
    } catch (err) {
        console.error("❌ Login Error:", err.message);
        if (err.code === "42P01") {
            return res.status(500).json({ message: "Database tables missing. Did you run the migration?" });
        }
        res.status(500).json({ message: "Server error: " + err.message });
    }
});

// ============================================================
//  USER — Explicit full registration with email + password
// ============================================================
router.post("/user/register", async (req, res) => {
    try {
        const { phone, name, email, password } = req.body;
        if (!phone || !name) return res.status(400).json({ message: "Phone and name are required" });

        const existing = await User.findOne({ phone });
        if (existing) return res.status(409).json({ message: "Phone already registered — please log in" });

        if (email) {
            const emailExists = await User.findOne({ email });
            if (emailExists) return res.status(409).json({ message: "Email already in use" });
        }

        const user = await User.create({ phone, name: name.trim(), email: email?.trim() || null, password: password?.trim() || null });
        const token = signToken({ id: user._id, role: "user" });
        res.status(201).json({
            token,
            user: { _id: user._id, name: user.name, phone: user.phone, email: user.email, role: "user" }
        });
    } catch (err) {
        console.error("❌ Register Error:", err.message);
        res.status(500).json({ message: "Server error: " + err.message });
    }
});

// ============================================================
//  CAPTAIN — Register
// ============================================================
router.post("/captain/register", async (req, res) => {
    try {
        const { name, phone, password, vehicle, insuranceCert, driverLicense, driverAadhaar } = req.body;
        if (!name || !phone || !password || !vehicle)
            return res.status(400).json({ message: "All fields are required" });
        if (!vehicle.type || !vehicle.plate || !vehicle.color || !vehicle.model)
            return res.status(400).json({ message: "Vehicle details incomplete" });
        if (!insuranceCert || !driverLicense || !driverAadhaar)
            return res.status(400).json({
                message: "Car insurance certificate, driver licence, and Aadhaar card are required",
            });

        const existing = await Captain.findOne({ phone });
        if (existing)
            return res.status(409).json({ message: "Phone already registered" });

        const captain = await Captain.create({ name, phone, password, vehicle, insuranceCert, driverLicense, driverAadhaar });
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

// ============================================================
//  CAPTAIN — Trip history (completed rides)
//  GET /api/auth/captain/trips?captainId=<uuid>&limit=50
// ============================================================
router.get("/captain/trips", async (req, res) => {
    try {
        const { captainId, limit = 50 } = req.query;
        if (!captainId) return res.status(400).json({ message: "captainId required" });

        const { rows } = await pool.query(
            `SELECT id, pickup, dropoff, fare, ride_type, payment_method,
                    rider_rating, status, created_at, updated_at
             FROM rides
             WHERE captain_id = $1
               AND status = 'completed'
             ORDER BY created_at DESC
             LIMIT $2`,
            [captainId, Number(limit)]
        );

        const trips = rows.map((r) => ({
            id: r.id,
            pickup: r.pickup,
            dropoff: r.dropoff,
            fare: r.fare ? parseFloat(r.fare) : 0,
            rideType: r.ride_type,
            payment: r.payment_method,
            riderRating: r.rider_rating ? parseFloat(r.rider_rating) : null,
            status: r.status,
            date: r.created_at,
        }));

        res.json({ trips });
    } catch (err) {
        console.error("captain/trips error:", err.message);
        res.status(500).json({ message: "Server error" });
    }
});

// ============================================================
//  USER — Ride history
//  GET /api/auth/user/trips?userId=<uuid>&limit=50
// ============================================================
router.get("/user/trips", async (req, res) => {
    try {
        const { userId, limit = 50 } = req.query;
        if (!userId) return res.status(400).json({ message: "userId required" });

        const { rows } = await pool.query(
            `SELECT r.id, r.pickup, r.dropoff, r.fare, r.ride_type,
                    r.payment_method, r.rider_rating, r.status, r.created_at,
                    c.name AS captain_name, c.rating AS captain_rating,
                    c.vehicle_type, c.vehicle_model
             FROM rides r
             LEFT JOIN captains c ON r.captain_id = c.id
             WHERE r.rider_id = $1
               AND r.status IN ('completed','cancelled')
             ORDER BY r.created_at DESC
             LIMIT $2`,
            [userId, Number(limit)]
        );

        const trips = rows.map((r) => ({
            id: r.id,
            pickup: r.pickup,
            dropoff: r.dropoff,
            fare: r.fare ? parseFloat(r.fare) : 0,
            rideType: r.ride_type,
            payment: r.payment_method,
            riderRating: r.rider_rating ? parseFloat(r.rider_rating) : null,
            status: r.status,
            date: r.created_at,
            captain: r.captain_name ? {
                name: r.captain_name,
                rating: r.captain_rating,
                vehicleType: r.vehicle_type,
                vehicleModel: r.vehicle_model,
            } : null,
        }));

        res.json({ trips });
    } catch (err) {
        console.error("user/trips error:", err.message);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;

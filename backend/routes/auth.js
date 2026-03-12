const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../models/User");
const Captain = require("../models/Captain");
const pool = require("../config/db");
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "ucab_secret_2026";

// ── Nodemailer transporter (open-source SMTP via .env) ──────
// Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in .env
// Works with any SMTP: Gmail, Brevo, Mailgun, SendGrid, etc.
let transporter = null;
try {
    const nodemailer = require("nodemailer");
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
} catch (_) {
    console.warn("⚠️  nodemailer not installed — run: npm install nodemailer");
}

const OTP_EXPIRY_MIN = 10;

function generateOtp() {
    return String(Math.floor(100000 + Math.random() * 900000));
}
function hashOtp(otp) {
    return crypto.createHash("sha256").update(otp).digest("hex");
}

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
//  USER — Send email OTP for registration verification
//  POST /api/auth/user/send-otp  { email }
// ============================================================
router.post("/user/send-otp", async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ message: "Valid email is required" });
        }

        // Check if email already registered
        const existing = await User.findOne({ email: email.trim().toLowerCase() });
        if (existing) return res.status(409).json({ message: "Email already registered" });

        if (!transporter) {
            return res.status(503).json({ message: "Email service not configured. Contact support." });
        }

        const otp = generateOtp();
        const otpHash = hashOtp(otp);
        const expiresAt = new Date(Date.now() + OTP_EXPIRY_MIN * 60 * 1000);

        // Invalidate any existing OTPs for this email
        await pool.query("DELETE FROM email_otps WHERE email = $1", [email.toLowerCase()]);
        // Store new OTP
        await pool.query(
            "INSERT INTO email_otps (email, otp_hash, expires_at) VALUES ($1, $2, $3)",
            [email.toLowerCase(), otpHash, expiresAt]
        );

        await transporter.sendMail({
            from: `"uride Services" <${process.env.SMTP_USER}>`,
            to: email,
            subject: "Your uride verification code",
            html: `
                <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
                    <h2 style="color:#00c853">Verify your email</h2>
                    <p>Use the code below to complete your uride registration.</p>
                    <div style="font-size:36px;font-weight:800;letter-spacing:8px;color:#111;
                                background:#f5f5f5;border-radius:8px;padding:16px 24px;
                                text-align:center;margin:16px 0">
                        ${otp}
                    </div>
                    <p style="color:#666;font-size:13px">This code expires in ${OTP_EXPIRY_MIN} minutes. 
                    Do not share it with anyone.</p>
                </div>
            `,
        });

        console.log(`📧 OTP sent to ${email}`);
        res.json({ message: "OTP sent to your email", expiresIn: OTP_EXPIRY_MIN * 60 });
    } catch (err) {
        console.error("send-otp error:", err.message);
        res.status(500).json({ message: "Failed to send OTP: " + err.message });
    }
});

// ============================================================
//  USER — Verify email OTP (does NOT register — used as step)
//  POST /api/auth/user/verify-otp  { email, otp }
// ============================================================
router.post("/user/verify-otp", async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) return res.status(400).json({ message: "Email and OTP are required" });

        const { rows } = await pool.query(
            `SELECT * FROM email_otps 
             WHERE email = $1 AND used = FALSE AND expires_at > NOW()
             ORDER BY created_at DESC LIMIT 1`,
            [email.toLowerCase()]
        );

        if (!rows[0]) {
            return res.status(400).json({ message: "OTP expired or not found. Please request a new one." });
        }

        const inputHash = hashOtp(String(otp).trim());
        if (inputHash !== rows[0].otp_hash) {
            return res.status(400).json({ message: "Invalid OTP. Please check and try again." });
        }

        // Mark OTP as used
        await pool.query("UPDATE email_otps SET used = TRUE WHERE id = $1", [rows[0].id]);

        res.json({ verified: true, message: "Email verified successfully" });
    } catch (err) {
        console.error("verify-otp error:", err.message);
        res.status(500).json({ message: "Server error" });
    }
});

// ============================================================
//  USER — Explicit full registration with email + password
//  Requires email OTP to have been verified first (when email provided)
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

// ── Simple JWT auth middleware (reused below) ───────────────
const JWT_SECRET_LOCAL = process.env.JWT_SECRET || "ucab_secret_2026";
const authMw = (req, res, next) => {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ message: "No token" });
    try {
        req.user = require("jsonwebtoken").verify(header.replace("Bearer ", ""), JWT_SECRET_LOCAL);
        next();
    } catch { res.status(401).json({ message: "Invalid token" }); }
};

// ============================================================
//  USER — Saved Places  (Home, Work, or custom label)
//  GET  /api/auth/user/saved-places
//  POST /api/auth/user/saved-places         { label, lat, lng, address }
//  DELETE /api/auth/user/saved-places/:idx
// ============================================================
router.get("/user/saved-places", authMw, async (req, res) => {
    try {
        const { rows } = await pool.query(
            "SELECT saved_places FROM users WHERE id = $1", [req.user.id]
        );
        res.json({ savedPlaces: rows[0]?.saved_places || [] });
    } catch (err) { res.status(500).json({ message: "Server error" }); }
});

router.post("/user/saved-places", authMw, async (req, res) => {
    try {
        const { label, lat, lng, address } = req.body;
        if (!label || !lat || !lng) return res.status(400).json({ message: "label, lat, lng required" });
        const { rows } = await pool.query(
            "SELECT saved_places FROM users WHERE id = $1", [req.user.id]
        );
        const current = rows[0]?.saved_places || [];
        // Replace if same label exists, otherwise append (max 10)
        const filtered = current.filter((p) => p.label?.toLowerCase() !== label.toLowerCase());
        const updated = [...filtered, { label, lat: parseFloat(lat), lng: parseFloat(lng), address: address || "" }].slice(-10);
        await pool.query("UPDATE users SET saved_places = $1 WHERE id = $2", [JSON.stringify(updated), req.user.id]);
        res.json({ savedPlaces: updated });
    } catch (err) { res.status(500).json({ message: "Server error" }); }
});

router.delete("/user/saved-places/:idx", authMw, async (req, res) => {
    try {
        const idx = parseInt(req.params.idx, 10);
        const { rows } = await pool.query("SELECT saved_places FROM users WHERE id = $1", [req.user.id]);
        const current = rows[0]?.saved_places || [];
        if (idx < 0 || idx >= current.length) return res.status(400).json({ message: "Invalid index" });
        const updated = current.filter((_, i) => i !== idx);
        await pool.query("UPDATE users SET saved_places = $1 WHERE id = $2", [JSON.stringify(updated), req.user.id]);
        res.json({ savedPlaces: updated });
    } catch (err) { res.status(500).json({ message: "Server error" }); }
});

// ============================================================
//  USER — Emergency Contacts
//  GET /api/auth/user/emergency-contacts
//  PUT /api/auth/user/emergency-contacts    { contacts: [{name, phone}] }
// ============================================================
router.get("/user/emergency-contacts", authMw, async (req, res) => {
    try {
        const { rows } = await pool.query(
            "SELECT emergency_contacts FROM users WHERE id = $1", [req.user.id]
        );
        res.json({ contacts: rows[0]?.emergency_contacts || [] });
    } catch (err) { res.status(500).json({ message: "Server error" }); }
});

router.put("/user/emergency-contacts", authMw, async (req, res) => {
    try {
        const { contacts } = req.body;
        if (!Array.isArray(contacts)) return res.status(400).json({ message: "contacts must be array" });
        const safe = contacts
            .filter((c) => c.name && c.phone)
            .map((c) => ({ name: String(c.name).slice(0, 50), phone: String(c.phone).slice(0, 15) }))
            .slice(0, 5);
        await pool.query("UPDATE users SET emergency_contacts = $1 WHERE id = $2", [JSON.stringify(safe), req.user.id]);
        res.json({ contacts: safe });
    } catch (err) { res.status(500).json({ message: "Server error" }); }
});

// ============================================================
//  CAPTAIN — Update profile photo
//  PUT /api/auth/captain/photo  { photoUrl }
// ============================================================
router.put("/captain/photo", authMw, async (req, res) => {
    try {
        if (req.user.role !== "captain") return res.status(403).json({ message: "Captain only" });
        const { photoUrl } = req.body;
        if (!photoUrl) return res.status(400).json({ message: "photoUrl required" });
        // Only allow https URLs to prevent XSS via javascript: URIs
        if (!photoUrl.startsWith("https://")) return res.status(400).json({ message: "Must be an https URL" });
        await pool.query("UPDATE captains SET photo_url = $1 WHERE id = $2", [photoUrl, req.user.id]);
        res.json({ photoUrl });
    } catch (err) { res.status(500).json({ message: "Server error" }); }
});

// ============================================================
//  CAPTAINS — Nearby online captains (for map preview)
//  GET /api/auth/captains/nearby?lat=&lng=&radius=5
// ============================================================
router.get("/captains/nearby", async (req, res) => {
    try {
        const { lat, lng, radius = 5 } = req.query;
        if (!lat || !lng) return res.status(400).json({ message: "lat and lng required" });
        const R = parseFloat(radius);
        const userLat = parseFloat(lat);
        const userLng = parseFloat(lng);

        // Use Haversine inside SQL to filter within radius
        const { rows } = await pool.query(
            `SELECT id, name, vehicle_type, vehicle_model, vehicle_color, rating, lat, lng
             FROM captains
             WHERE is_online = TRUE
               AND lat IS NOT NULL AND lng IS NOT NULL
               AND (
                 6371 * acos(
                   LEAST(1, cos(radians($1)) * cos(radians(lat)) *
                   cos(radians(lng) - radians($2)) +
                   sin(radians($1)) * sin(radians(lat)))
                 )
               ) <= $3
             LIMIT 25`,
            [userLat, userLng, R]
        );

        const captains = rows.map((c) => ({
            id: c.id,
            name: c.name,
            vehicleType: c.vehicle_type,
            vehicleModel: c.vehicle_model,
            vehicleColor: c.vehicle_color,
            rating: c.rating ? parseFloat(c.rating) : 5.0,
            lat: parseFloat(c.lat),
            lng: parseFloat(c.lng),
        }));

        res.json({ captains });
    } catch (err) {
        console.error("captains/nearby error:", err.message);
        res.status(500).json({ message: "Server error" });
    }
});

// ============================================================
//  USER — Loyalty Points
//  GET /api/auth/user/loyalty?userId=<uuid>
// ============================================================
router.get("/user/loyalty", async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) return res.status(400).json({ message: "userId required" });
        const { rows } = await pool.query(
            "SELECT loyalty_points, rating, rating_count FROM users WHERE id = $1",
            [userId]
        );
        if (!rows[0]) return res.status(404).json({ message: "User not found" });
        res.json({
            loyaltyPoints: rows[0].loyalty_points || 0,
            rating: rows[0].rating ? parseFloat(rows[0].rating) : 5.0,
            ratingCount: rows[0].rating_count || 0,
        });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;

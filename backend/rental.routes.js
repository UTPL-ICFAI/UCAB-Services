/**
 * rental.routes.js
 * Rental vehicle booking endpoints for users and rental owners
 */
const express = require("express");
const jwt = require("jsonwebtoken");
const pool = require("./config/db");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "ucab_secret_2026";

// ── Auth middleware ──────────────────────────────────────────
const auth = (req, res, next) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ error: "Invalid token" });
    }
};

// ── POST /api/rental/booking — Create rental booking ─────────────────
router.post("/booking", auth, async (req, res) => {
    try {
        const {
            vehicleId, ownerId, startDate, endDate, dailyRate,
            pickupLocation, // { lat, lng, address }
            insurance = false,
            insuranceAmount = 0,
        } = req.body;

        if (!vehicleId || !ownerId || !startDate || !endDate) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const pickupCoords = `${pickupLocation.lat},${pickupLocation.lng}`;
        
        // Calculate total price
        const start = new Date(startDate);
        const end = new Date(endDate);
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        const totalPrice = (dailyRate * days) + (insurance ? insuranceAmount : 0);

        const { rows } = await pool.query(
            `INSERT INTO rental_bookings 
             (rider_id, vehicle_id, owner_id, status, pickup_location, pickup_coords, 
              start_date, end_date, daily_rate, total_price, insurance_selected, insurance_amount)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING *`,
            [
                req.user.id,
                vehicleId,
                ownerId,
                "pending",
                JSON.stringify(pickupLocation),
                pickupCoords,
                startDate,
                endDate,
                dailyRate,
                totalPrice,
                insurance,
                insuranceAmount,
            ]
        );

        res.status(201).json({
            booking: rows[0],
            message: "✅ Rental booking request sent to owner",
        });
    } catch (err) {
        console.error("POST /api/rental/booking error:", err.message);
        res.status(500).json({ error: "Server error" });
    }
});

// ── GET /api/rental/booking/:bookingId — Get booking details ────────────
router.get("/booking/:bookingId", auth, async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT rb.*, fv.vehicle_name, fv.vehicle_model, fv.daily_rate as vehicle_daily_rate,
                    fo.name as owner_name, u.name as rider_name
             FROM rental_bookings rb
             LEFT JOIN fleet_vehicles fv ON rb.vehicle_id = fv.id
             LEFT JOIN fleet_owners fo ON rb.owner_id = fo.id
             LEFT JOIN users u ON rb.rider_id = u.id
             WHERE rb.id = $1 AND (rb.rider_id = $2 OR rb.owner_id = $3)`,
            [req.params.bookingId, req.user.id, req.user.id]
        );

        if (!rows.length) {
            return res.status(404).json({ error: "Booking not found" });
        }

        res.json({ booking: rows[0] });
    } catch (err) {
        console.error("GET /api/rental/booking error:", err.message);
        res.status(500).json({ error: "Server error" });
    }
});

// ── PUT /api/rental/booking/:bookingId/accept — Owner accepts booking ───────
router.put("/booking/:bookingId/accept", auth, async (req, res) => {
    try {
        const { ownerPickupLocation } = req.body; // { lat, lng, address }

        if (!ownerPickupLocation) {
            return res.status(400).json({ error: "Pickup location required" });
        }

        const ownerPickupCoords = `${ownerPickupLocation.lat},${ownerPickupLocation.lng}`;

        const { rows } = await pool.query(
            `UPDATE rental_bookings 
             SET status = $1, owner_pickup_location = $2, owner_pickup_coords = $3, updated_at = NOW()
             WHERE id = $4 AND owner_id = $5
             RETURNING *`,
            ["accepted", JSON.stringify(ownerPickupLocation), ownerPickupCoords, req.params.bookingId, req.user.id]
        );

        if (!rows.length) {
            return res.status(404).json({ error: "Booking not found or unauthorized" });
        }

        res.json({ booking: rows[0], message: "✅ Booking accepted" });
    } catch (err) {
        console.error("PUT /api/rental/booking/accept error:", err.message);
        res.status(500).json({ error: "Server error" });
    }
});

// ── PUT /api/rental/booking/:bookingId/reject — Owner rejects booking ────────
router.put("/booking/:bookingId/reject", auth, async (req, res) => {
    try {
        const { rows } = await pool.query(
            `UPDATE rental_bookings 
             SET status = $1, updated_at = NOW()
             WHERE id = $2 AND owner_id = $3
             RETURNING *`,
            ["rejected", req.params.bookingId, req.user.id]
        );

        if (!rows.length) {
            return res.status(404).json({ error: "Booking not found or unauthorized" });
        }

        res.json({ booking: rows[0], message: "✅ Booking rejected" });
    } catch (err) {
        console.error("PUT /api/rental/booking/reject error:", err.message);
        res.status(500).json({ error: "Server error" });
    }
});

// ── PUT /api/rental/booking/:bookingId/dropoff — Rider sets exit point ──────
router.put("/booking/:bookingId/dropoff", auth, async (req, res) => {
    try {
        const { dropoffLocation } = req.body; // { lat, lng, address }

        if (!dropoffLocation) {
            return res.status(400).json({ error: "Dropoff location required" });
        }

        const dropoffCoords = `${dropoffLocation.lat},${dropoffLocation.lng}`;

        const { rows } = await pool.query(
            `UPDATE rental_bookings 
             SET dropoff_location = $1, dropoff_coords = $2, updated_at = NOW()
             WHERE id = $3 AND rider_id = $4 AND status IN ('accepted', 'active')
             RETURNING *`,
            [JSON.stringify(dropoffLocation), dropoffCoords, req.params.bookingId, req.user.id]
        );

        if (!rows.length) {
            return res.status(404).json({ error: "Booking not found or cannot be modified" });
        }

        res.json({ booking: rows[0], message: "✅ Exit point set" });
    } catch (err) {
        console.error("PUT /api/rental/booking/dropoff error:", err.message);
        res.status(500).json({ error: "Server error" });
    }
});

// ── PUT /api/rental/booking/:bookingId/complete — Mark booking complete ─────
router.put("/booking/:bookingId/complete", auth, async (req, res) => {
    try {
        const { rows } = await pool.query(
            `UPDATE rental_bookings 
             SET status = $1, completed_at = NOW(), updated_at = NOW()
             WHERE id = $2 AND (rider_id = $3 OR owner_id = $4)
             RETURNING *`,
            ["completed", req.params.bookingId, req.user.id, req.user.id]
        );

        if (!rows.length) {
            return res.status(404).json({ error: "Booking not found" });
        }

        res.json({ booking: rows[0], message: "✅ Booking completed" });
    } catch (err) {
        console.error("PUT /api/rental/booking/complete error:", err.message);
        res.status(500).json({ error: "Server error" });
    }
});

// ── GET /api/rental/bookings?role=owner|rider — Get all bookings for user ────
router.get("/bookings", auth, async (req, res) => {
    try {
        const role = req.query.role || "rider"; // "rider" or "owner"

        let query, params;

        if (role === "owner") {
            query = `
                SELECT rb.*, fv.vehicle_name, fv.vehicle_model,
                       u.name as rider_name, u.phone as rider_phone
                FROM rental_bookings rb
                LEFT JOIN fleet_vehicles fv ON rb.vehicle_id = fv.id
                LEFT JOIN users u ON rb.rider_id = u.id
                WHERE rb.owner_id = $1
                ORDER BY rb.created_at DESC
            `;
            params = [req.user.id];
        } else {
            query = `
                SELECT rb.*, fv.vehicle_name, fv.vehicle_model,
                       fo.name as owner_name, fo.phone as owner_phone
                FROM rental_bookings rb
                LEFT JOIN fleet_vehicles fv ON rb.vehicle_id = fv.id
                LEFT JOIN fleet_owners fo ON rb.owner_id = fo.id
                WHERE rb.rider_id = $1
                ORDER BY rb.created_at DESC
            `;
            params = [req.user.id];
        }

        const { rows } = await pool.query(query, params);
        res.json({ bookings: rows });
    } catch (err) {
        console.error("GET /api/rental/bookings error:", err.message);
        res.status(500).json({ error: "Server error" });
    }
});

// ── GET /api/rental/demo-credentials — Get demo rental owner credentials ──
router.get("/demo-credentials", async (req, res) => {
    try {
        res.json({
            demoRentalOwner: {
                email: "rentalowner@demo.com",
                password: "demo123",
                name: "Demo Rental Provider",
                phone: "+91-98765-43210",
                company: "Demo Rentals",
                totalVehicles: 5,
                vehicles: [
                    {
                        name: "Hatchback",
                        model: "Hyundai i20",
                        perHr: 150,
                        icon: "🚗",
                        features: ["AC", "Power Steering", "Airbags"]
                    },
                    {
                        name: "Sedan",
                        model: "Maruti Swift",
                        perHr: 200,
                        icon: "🚙",
                        features: ["AC", "Bluetooth", "Touchscreen"]
                    },
                    {
                        name: "SUV",
                        model: "Mahindra XUV",
                        perHr: 300,
                        icon: "🚕",
                        features: ["4WD", "Sunroof", "Cruise Control"]
                    },
                    {
                        name: "Bike",
                        model: "Honda CB Shine",
                        perHr: 80,
                        icon: "🏍️",
                        features: ["Fuel Efficient", "LED Lights"]
                    },
                    {
                        name: "Scooter",
                        model: "Vespa",
                        perHr: 60,
                        icon: "🛵",
                        features: ["Easy to Ride", "Fuel Efficient"]
                    }
                ],
                location: "Bangalore, India",
                joinedDate: "2024-01-01"
            },
            instructions: {
                step1: "Use the credentials above to login as a rental owner via /login/rental",
                step2: "Once logged in, you can view pending rental booking requests",
                step3: "Accept bookings and set your pickup location",
                step4: "Riders will then set their exit/return point",
                step5: "Complete bookings after vehicle handover"
            }
        });
    } catch (err) {
        console.error("GET /api/rental/demo-credentials error:", err.message);
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;

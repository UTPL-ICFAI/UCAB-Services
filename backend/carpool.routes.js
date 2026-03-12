/**
 * carpool.routes.js
 * REST API for the car pooling feature.
 *
 * Routes:
 *   POST   /api/carpool            — driver creates a carpool ride
 *   GET    /api/carpool            — list active carpool rides
 *   GET    /api/carpool/:id        — get single carpool ride + bookings
 *   POST   /api/carpool/:id/book   — rider books a seat
 *   PUT    /api/carpool/bookings/:bookingId/respond — driver accepts/rejects
 *   DELETE /api/carpool/:id        — driver cancels their carpool ride
 */

const express = require("express");
const pool = require("./config/db");
const router = express.Router();

// ── POST /api/carpool — Driver creates a carpool ride ─────────
router.post("/", async (req, res) => {
    try {
        const {
            driverId, driverName, driverPhone,
            vehicleDesc,
            origin, destination,
            departureTime,
            totalSeats, pricePerSeat,
        } = req.body;

        if (!driverId || !driverName || !driverPhone) {
            return res.status(400).json({ message: "Driver details required" });
        }
        if (!origin?.address) {
            return res.status(400).json({ message: "Origin address required" });
        }
        if (!destination?.address) {
            return res.status(400).json({ message: "Destination address required" });
        }
        if (!departureTime) {
            return res.status(400).json({ message: "Departure time required" });
        }
        const seats = parseInt(totalSeats) || 3;
        if (seats < 1 || seats > 8) {
            return res.status(400).json({ message: "Seats must be between 1 and 8" });
        }
        const price = parseFloat(pricePerSeat) || 50;
        if (price < 0) {
            return res.status(400).json({ message: "Price cannot be negative" });
        }

        const { rows } = await pool.query(
            `INSERT INTO carpool_rides
               (driver_id, driver_name, driver_phone, vehicle_desc,
                origin, destination, departure_time,
                total_seats, available_seats, price_per_seat)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8,$9)
             RETURNING *`,
            [
                driverId, driverName, driverPhone,
                vehicleDesc || "",
                JSON.stringify(origin), JSON.stringify(destination),
                departureTime,
                seats, price,
            ]
        );

        res.status(201).json({ carpool: formatRow(rows[0]) });
    } catch (err) {
        console.error("carpool create error:", err.message);
        res.status(500).json({ message: "Server error" });
    }
});

// ── GET /api/carpool — List active carpool rides ──────────────
router.get("/", async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT * FROM carpool_rides
             WHERE status = 'active'
               AND departure_time > NOW() - INTERVAL '30 minutes'
             ORDER BY departure_time ASC
             LIMIT 50`
        );
        res.json({ carpools: rows.map(formatRow) });
    } catch (err) {
        console.error("carpool list error:", err.message);
        res.status(500).json({ message: "Server error" });
    }
});

// ── GET /api/carpool/:id — Single carpool + bookings ─────────
router.get("/:id", async (req, res) => {
    try {
        const { rows } = await pool.query(
            "SELECT * FROM carpool_rides WHERE id = $1",
            [req.params.id]
        );
        if (!rows[0]) return res.status(404).json({ message: "Carpool not found" });

        const { rows: bookings } = await pool.query(
            "SELECT * FROM carpool_bookings WHERE carpool_id = $1 ORDER BY created_at ASC",
            [req.params.id]
        );

        res.json({ carpool: formatRow(rows[0]), bookings });
    } catch (err) {
        console.error("carpool get error:", err.message);
        res.status(500).json({ message: "Server error" });
    }
});

// ── POST /api/carpool/:id/book — Rider books a seat ──────────
router.post("/:id/book", async (req, res) => {
    try {
        const { riderId, riderName, riderPhone, seats = 1 } = req.body;
        if (!riderId || !riderName || !riderPhone) {
            return res.status(400).json({ message: "Rider details required" });
        }
        const requestedSeats = parseInt(seats) || 1;

        // Check carpool and available seats
        const { rows: cr } = await pool.query(
            "SELECT * FROM carpool_rides WHERE id = $1 AND status = 'active'",
            [req.params.id]
        );
        if (!cr[0]) return res.status(404).json({ message: "Carpool not found or no longer active" });
        if (requestedSeats > cr[0].available_seats) {
            return res.status(400).json({ message: `Only ${cr[0].available_seats} seat(s) available` });
        }

        // Prevent duplicate booking by same rider
        const { rows: existing } = await pool.query(
            `SELECT id FROM carpool_bookings 
             WHERE carpool_id = $1 AND rider_id = $2 AND status NOT IN ('rejected','cancelled')`,
            [req.params.id, riderId]
        );
        if (existing.length > 0) {
            return res.status(409).json({ message: "You already have a booking on this carpool" });
        }

        const { rows: booking } = await pool.query(
            `INSERT INTO carpool_bookings (carpool_id, rider_id, rider_name, rider_phone, seats)
             VALUES ($1,$2,$3,$4,$5) RETURNING *`,
            [req.params.id, riderId, riderName, riderPhone, requestedSeats]
        );

        res.status(201).json({ booking: booking[0] });
    } catch (err) {
        console.error("carpool book error:", err.message);
        res.status(500).json({ message: "Server error" });
    }
});

// ── PUT /api/carpool/bookings/:bookingId/respond ─────────────
// Driver accepts or rejects a booking
router.put("/bookings/:bookingId/respond", async (req, res) => {
    try {
        const { action } = req.body;
        // normalise: accept → accepted, reject → rejected
        const action_norm = action === "accept" ? "accepted" : action === "reject" ? "rejected" : action;
        if (!["accepted", "rejected"].includes(action_norm)) {
            return res.status(400).json({ message: "action must be 'accept' or 'reject'" });
        }

        // Get booking + ride info
        const { rows: bk } = await pool.query(
            `SELECT b.*, c.driver_id, c.available_seats, c.total_seats
             FROM carpool_bookings b
             JOIN carpool_rides c ON b.carpool_id = c.id
             WHERE b.id = $1`,
            [req.params.bookingId]
        );
        if (!bk[0]) return res.status(404).json({ message: "Booking not found" });
        if (bk[0].status !== "pending") {
            return res.status(400).json({ message: "Booking already responded to" });
        }

        await pool.query(
            "UPDATE carpool_bookings SET status = $1 WHERE id = $2",
            [action_norm, req.params.bookingId]
        );

        if (action_norm === "accepted") {
            // Deduct seats and mark full if needed
            const newAvail = Math.max(0, bk[0].available_seats - bk[0].seats);
            const newStatus = newAvail === 0 ? "full" : "active";
            await pool.query(
                "UPDATE carpool_rides SET available_seats = $1, status = $2 WHERE id = $3",
                [newAvail, newStatus, bk[0].carpool_id]
            );
        }

        res.json({ message: `Booking ${action_norm}`, bookingId: req.params.bookingId });
    } catch (err) {
        console.error("carpool respond error:", err.message);
        res.status(500).json({ message: "Server error" });
    }
});

// ── DELETE /api/carpool/:id — Driver cancels their ride ──────
router.delete("/:id", async (req, res) => {
    try {
        // driverId may come from body or query (axios.delete sends body under req.body)
        const driverId = req.body?.driverId || req.query?.driverId;

        const { rows } = await pool.query(
            "SELECT driver_id FROM carpool_rides WHERE id = $1",
            [req.params.id]
        );
        if (!rows[0]) return res.status(404).json({ message: "Carpool not found" });
        // If driverId supplied, verify ownership; otherwise skip check
        if (driverId && rows[0].driver_id !== driverId) {
            return res.status(403).json({ message: "Only the driver can cancel this carpool" });
        }

        await pool.query(
            "UPDATE carpool_rides SET status = 'cancelled' WHERE id = $1",
            [req.params.id]
        );
        res.json({ message: "Carpool cancelled" });
    } catch (err) {
        console.error("carpool delete error:", err.message);
        res.status(500).json({ message: "Server error" });
    }
});

// ── GET /api/carpool/my/:userId — User's rides (as driver) + bookings (as rider) ─
router.get("/my/:userId", async (req, res) => {
    try {
        const userId = req.params.userId;

        // Rides where this user is the driver
        const { rows: rideRows } = await pool.query(
            `SELECT * FROM carpool_rides
             WHERE driver_id = $1
             ORDER BY departure_time DESC LIMIT 20`,
            [userId]
        );

        // Fetch all bookings for those rides in one query
        let bookingsMap = {};
        if (rideRows.length > 0) {
            const rideIds = rideRows.map((r) => r.id);
            const { rows: allBookings } = await pool.query(
                `SELECT * FROM carpool_bookings
                 WHERE carpool_id = ANY($1::uuid[])
                 ORDER BY created_at ASC`,
                [rideIds]
            );
            allBookings.forEach((b) => {
                if (!bookingsMap[b.carpool_id]) bookingsMap[b.carpool_id] = [];
                bookingsMap[b.carpool_id].push(b);
            });
        }

        const rides = rideRows.map((r) => ({
            ...formatRow(r),
            bookings: (bookingsMap[r.id] || []).map((b) => ({
                id: b.id,
                riderName: b.rider_name,
                riderPhone: b.rider_phone,
                seats: b.seats,
                status: b.status,
            })),
        }));

        // Bookings where this user is the rider
        const { rows: bookingRows } = await pool.query(
            `SELECT cb.*, cr.origin, cr.destination, cr.departure_time,
                    cr.price_per_seat, cr.driver_name
             FROM carpool_bookings cb
             JOIN carpool_rides cr ON cb.carpool_id = cr.id
             WHERE cb.rider_id = $1
             ORDER BY cb.created_at DESC LIMIT 20`,
            [userId]
        );

        const bookings = bookingRows.map((b) => ({
            id: b.id,
            carpoolId: b.carpool_id,
            riderName: b.rider_name,
            seats: b.seats,
            status: b.status,
            driverName: b.driver_name,
            departureTime: b.departure_time,
            origin: typeof b.origin === "string" ? JSON.parse(b.origin) : b.origin,
            destination: typeof b.destination === "string" ? JSON.parse(b.destination) : b.destination,
            pricePerSeat: parseFloat(b.price_per_seat) || 0,
            totalCost: b.seats * (parseFloat(b.price_per_seat) || 0),
        }));

        res.json({ rides, bookings });
    } catch (err) {
        console.error("carpool my error:", err.message);
        res.status(500).json({ message: "Server error" });
    }
});

// ── Helper ────────────────────────────────────────────────────
function formatRow(r) {
    return {
        id: r.id,
        driverId: r.driver_id,
        driverName: r.driver_name,
        driverPhone: r.driver_phone,
        vehicleDesc: r.vehicle_desc,
        origin: typeof r.origin === "string" ? JSON.parse(r.origin) : r.origin,
        destination: typeof r.destination === "string" ? JSON.parse(r.destination) : r.destination,
        departureTime: r.departure_time,
        totalSeats: r.total_seats,
        availableSeats: r.available_seats,
        pricePerSeat: r.price_per_seat ? parseFloat(r.price_per_seat) : 0,
        status: r.status,
        pendingCount: r.pending_count ? parseInt(r.pending_count) : 0,
        createdAt: r.created_at,
    };
}

module.exports = router;

/**
 * test-data.routes.js
 * API endpoints for seeding test data (development only)
 * Should be removed before production
 */

const express = require("express");
const pool = require("./config/db");
const router = express.Router();

// ── POST /api/test-data/seed-rental-vehicles ─────────────────────
// Add dummy rental vehicles for testing
router.post("/seed-rental-vehicles", async (req, res) => {
    try {
        // Check for demo rental owner
        const ownerRes = await pool.query(
            "SELECT id FROM fleet_owners WHERE email = $1",
            ["rentalowner@demo.com"]
        );

        if (ownerRes.rows.length === 0) {
            return res.status(404).json({ message: "Demo rental owner not found. Please login with rentalowner@demo.com first." });
        }

        const ownerId = ownerRes.rows[0].id;

        // Sample vehicles to insert
        const vehicles = [
            { type: "Car", number: "DL01AB0001", driver: "Rajesh Kumar", phone: "+91-9876543210", seats: 5, color: "White" },
            { type: "Car", number: "DL01AB0002", driver: "Priya Singh", phone: "+91-9876543211", seats: 5, color: "Silver" },
            { type: "Car", number: "DL01AB0003", driver: "Amit Patel", phone: "+91-9876543212", seats: 5, color: "Black" },
            { type: "SUV", number: "DL01CD0001", driver: "Vikram Sharma", phone: "+91-9876543213", seats: 7, color: "Grey" },
            { type: "Sedan", number: "DL01CD0002", driver: "Deepak Verma", phone: "+91-9876543214", seats: 4, color: "White" },
        ];

        const inserted = [];

        for (const v of vehicles) {
            const { rows } = await pool.query(
                `INSERT INTO fleet_vehicles 
                (owner_id, vehicle_type, vehicle_number, driver_name, driver_phone, seating_capacity, 
                 is_available, vehicle_color, driver_aadhaar, vehicle_insurance_cert, vehicle_registration,
                 vehicle_pollution_cert, insurance_verified, insurance_expiry_date)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW() + INTERVAL '1 year')
                ON CONFLICT (vehicle_number) DO NOTHING
                RETURNING id, vehicle_number, vehicle_type, seating_capacity`,
                [
                    ownerId, v.type, v.number, v.driver, v.phone, v.seats,
                    true, v.color, "123456789012",
                    "https://example.com/insurance.pdf",
                    "https://example.com/registration.pdf",
                    "https://example.com/pollution.pdf",
                    true
                ]
            );

            if (rows.length > 0) {
                inserted.push(rows[0]);
            }
        }

        res.json({
            message: `Seeded ${inserted.length} rental vehicles`,
            vehicles: inserted
        });
    } catch (err) {
        console.error("seed error:", err.message);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// ── POST /api/test-data/carpool-rides ─────────────────────────
// Create a test carpool ride
router.post("/carpool-rides", async (req, res) => {
    try {
        const testRide = {
            driverId: "test-driver-001",
            driverName: "Test Driver",
            driverPhone: "+91-9999999999",
            vehicleDesc: "Silver Maruti Swift",
            origin: {
                address: "Delhi Airport",
                lat: 28.5562,
                lng: 77.1000
            },
            destination: {
                address: "Connaught Place, Delhi",
                lat: 28.6307,
                lng: 77.2197
            },
            departureTime: new Date(Date.now() + 2 * 3600000).toISOString(),
            totalSeats: 4,
            pricePerSeat: 150
        };

        const { rows } = await pool.query(
            `INSERT INTO carpool_rides
            (driver_id, driver_name, driver_phone, vehicle_desc, origin, destination, 
             departure_time, total_seats, available_seats, price_per_seat, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *`,
            [
                testRide.driverId,
                testRide.driverName,
                testRide.driverPhone,
                testRide.vehicleDesc,
                JSON.stringify(testRide.origin),
                JSON.stringify(testRide.destination),
                testRide.departureTime,
                testRide.totalSeats,
                testRide.totalSeats,
                testRide.pricePerSeat,
                "active"
            ]
        );

        res.json({
            message: "Test carpool ride created",
            carpool: rows[0]
        });
    } catch (err) {
        console.error("carpool seed error:", err.message);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

module.exports = router;

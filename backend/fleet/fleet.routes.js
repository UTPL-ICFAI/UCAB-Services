const express = require("express");
const {
    registerOwner,
    getOwners,
    verifyOwner,
    loginOwner,
} = require("./controllers/fleetOwner.controller");
const {
    addVehicle,
    getVehiclesByOwner,
    updateAvailability,
} = require("./controllers/fleetVehicle.controller");
const {
    createBooking,
    getBookings,
    updateBookingStatus,
    createBookingV2,
    getRates,
} = require("./controllers/fleetBooking.controller");
const adminAuth = require("./middleware/adminAuth.middleware");

const router = express.Router();

// ── Fleet Owner Routes ────────────────────────────────────────
router.post("/owners", registerOwner);
router.post("/owners/login", loginOwner);
router.get("/owners", getOwners);
router.patch("/owners/:id/verify", adminAuth, verifyOwner);  // ← admin-only

// ── Fleet Vehicle Routes ──────────────────────────────────────
router.post("/vehicles", addVehicle);
router.get("/vehicles", getVehiclesByOwner);
router.patch("/vehicles/:id", updateAvailability);

// ── Fleet Booking Routes ──────────────────────────────────────
router.get("/rates", getRates);                // public — returns server-side pricing
router.post("/bookings", createBooking);       // v1 — unchanged
router.post("/bookings/v2", createBookingV2);  // v2 — supports bookingType enum
router.get("/bookings", getBookings);
router.patch("/bookings/:id", updateBookingStatus);

module.exports = router;


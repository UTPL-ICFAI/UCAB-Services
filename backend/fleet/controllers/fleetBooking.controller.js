const FleetBooking = require("../models/fleetBooking.model");
const FleetVehicle = require("../models/fleetVehicle.model");
const Captain = require("../../models/Captain");
const {
    assignDriver,
    assignVehicle,
    calculateFare,
    BOOKING_TYPES,
    DEFAULT_RATES,
} = require("../services/booking.service");

// ── GET /api/fleet/rates ──────────────────────────────────────
// Returns the server-side pricing rates so the frontend can display
// a read-only pricing preview before the user submits the form.
// Clients MUST NOT use these values to calculate fares themselves —
// the backend always recalculates on submission.
const getRates = (_req, res) => {
    res.json({
        hourlyRate: DEFAULT_RATES.DRIVER_ONLY_HOURLY,   // ₹/hr — DRIVER_ONLY
        dailyRate: DEFAULT_RATES.VEHICLE_ONLY_DAILY,     // ₹/day — VEHICLE_ONLY
        normalPerKm: DEFAULT_RATES.NORMAL_PER_KM,        // ₹/km — NORMAL
        normalEstimatedKm: DEFAULT_RATES.NORMAL_ESTIMATED_KM, // default fallback km
    });
};

// ── POST /api/fleet/bookings ──────────────────────────────────
// (Existing v1 handler — NOT modified)
const createBooking = async (req, res) => {
    try {
        const {
            clientName,
            clientPhone,
            clientEmail,
            clientType,
            vehicleType,
            numVehicles,
            pickupLocation,
            dropLocation,
            date,
        } = req.body;

        // Required field validation
        if (
            !clientName || !clientPhone || !clientEmail || !clientType ||
            !vehicleType || !numVehicles || !pickupLocation || !dropLocation || !date
        ) {
            return res.status(400).json({ message: "All booking fields are required" });
        }

        const count = Number(numVehicles);
        if (isNaN(count) || count < 1) {
            return res.status(400).json({ message: "numVehicles must be a positive number" });
        }

        // Check how many vehicles of requested type are available
        const availableVehicles = await FleetVehicle.find({
            vehicleType,
            isAvailable: true,
        }).limit(count);

        if (availableVehicles.length < count) {
            return res.status(409).json({
                message: `Only ${availableVehicles.length} ${vehicleType}(s) available, but ${count} requested`,
            });
        }

        // Create booking with assigned vehicles
        const assignedIds = availableVehicles.map((v) => v._id);

        const booking = await FleetBooking.create({
            clientName,
            clientPhone,
            clientEmail,
            clientType,
            vehicleType,
            numVehicles: count,
            pickupLocation,
            dropLocation,
            date: new Date(date),
            assignedVehicles: assignedIds,
        });

        // Mark those vehicles as unavailable
        await FleetVehicle.updateMany(
            { _id: { $in: assignedIds } },
            { isAvailable: false }
        );

        res.status(201).json({
            message: "Fleet booking created successfully",
            booking,
            assignedVehicles: availableVehicles,
        });
    } catch (err) {
        console.error("createBooking error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// ── GET /api/fleet/bookings?status=pending ────────────────────
const getBookings = async (req, res) => {
    try {
        const filter = {};
        if (req.query.status) filter.status = req.query.status;

        const bookings = await FleetBooking.find(filter)
            .populate("assignedVehicles", "vehicleNumber vehicleType driverName driverPhone")
            .populate("assignedDriverId", "name phone vehicle rating")
            .populate("assignedVehicleId", "vehicleNumber vehicleType driverName driverPhone")
            .sort({ createdAt: -1 });

        res.json({ bookings });
    } catch (err) {
        console.error("getBookings error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// ── PATCH /api/fleet/bookings/:id ────────────────────────────
const updateBookingStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const allowed = ["pending", "confirmed", "cancelled"];
        if (!allowed.includes(status)) {
            return res.status(400).json({ message: `status must be one of: ${allowed.join(", ")}` });
        }

        const booking = await FleetBooking.findById(req.params.id);
        if (!booking) return res.status(404).json({ message: "Booking not found" });

        // If cancelled, free up the vehicles
        if (status === "cancelled" && booking.status !== "cancelled") {
            await FleetVehicle.updateMany(
                { _id: { $in: booking.assignedVehicles } },
                { isAvailable: true }
            );
            // Also free up the v2 single vehicle if present
            if (booking.assignedVehicleId) {
                await FleetVehicle.findByIdAndUpdate(booking.assignedVehicleId, { isAvailable: true });
            }
        }

        booking.status = status;
        await booking.save();

        res.json({ message: `Booking ${status}`, booking });
    } catch (err) {
        console.error("updateBookingStatus error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// ── POST /api/fleet/bookings/v2 ───────────────────────────────
// Supports bookingType: NORMAL | DRIVER_ONLY | VEHICLE_ONLY
// Pricing is ALWAYS calculated server-side using DEFAULT_RATES.
// Clients must never supply fare, hourlyRate, or dailyRate.
const createBookingV2 = async (req, res) => {
    try {
        const {
            bookingType = "NORMAL",
            clientName,
            clientPhone,
            clientEmail,
            clientType,
            vehicleType,
            numVehicles,
            pickupLocation,
            dropLocation,
            date,
            // DRIVER_ONLY — client supplies only duration
            durationHours,
            customerVehicleDetails,
            purpose,
            // VEHICLE_ONLY — client supplies only duration
            durationDays,
        } = req.body;

        // ── 1. Validate bookingType ───────────────────────────────
        if (!Object.values(BOOKING_TYPES).includes(bookingType)) {
            return res.status(400).json({
                message: `Invalid bookingType "${bookingType}". Must be one of: ${Object.values(BOOKING_TYPES).join(", ")}`,
            });
        }

        // ── 2. Validate common required fields ────────────────────
        if (!clientName || !clientPhone || !clientEmail || !clientType ||
            !pickupLocation || !dropLocation || !date) {
            return res.status(400).json({ message: "All common booking fields are required" });
        }

        // ── 3. Per-type validation & resource resolution ──────────
        let selectedDriver = null;
        let selectedVehicle = null;
        let calculatedFare = 0;

        // ── DRIVER_ONLY ───────────────────────────────────────────
        if (bookingType === BOOKING_TYPES.DRIVER_ONLY) {
            if (
                !customerVehicleDetails ||
                !customerVehicleDetails.make ||
                !customerVehicleDetails.model ||
                !customerVehicleDetails.plate
            ) {
                return res.status(400).json({
                    message: "customerVehicleDetails (make, model, plate) is required for DRIVER_ONLY bookings",
                });
            }
            if (!durationHours || Number(durationHours) < 1) {
                return res.status(400).json({ message: "durationHours (≥1) is required for DRIVER_ONLY bookings" });
            }

            // Find available online captains
            const driverPool = await Captain.find({ isOnline: true }).limit(5);
            selectedDriver = assignDriver(driverPool);
            if (!selectedDriver) {
                return res.status(409).json({ message: "No online drivers available at the moment" });
            }

            // Calculate fare using SERVER-SIDE rate only
            try {
                calculatedFare = calculateFare(bookingType, { durationHours });
            } catch (e) {
                return res.status(400).json({ message: e.message });
            }
        }

        // ── VEHICLE_ONLY ──────────────────────────────────────────
        else if (bookingType === BOOKING_TYPES.VEHICLE_ONLY) {
            if (!vehicleType) {
                return res.status(400).json({ message: "vehicleType is required for VEHICLE_ONLY bookings" });
            }
            if (!durationDays || Number(durationDays) < 1) {
                return res.status(400).json({ message: "durationDays (≥1) is required for VEHICLE_ONLY bookings" });
            }

            const vehiclePool = await FleetVehicle.find({ vehicleType, isAvailable: true }).limit(1);
            selectedVehicle = assignVehicle(vehiclePool);
            if (!selectedVehicle) {
                return res.status(409).json({
                    message: `No available ${vehicleType} for VEHICLE_ONLY booking`,
                });
            }

            // Calculate fare using SERVER-SIDE rate only
            try {
                calculatedFare = calculateFare(bookingType, { durationDays });
            } catch (e) {
                return res.status(400).json({ message: e.message });
            }
        }

        // ── NORMAL ────────────────────────────────────────────────
        else {
            if (!vehicleType) {
                return res.status(400).json({ message: "vehicleType is required for NORMAL bookings" });
            }
            const count = Number(numVehicles) || 1;

            const driverPool = await Captain.find({ isOnline: true }).limit(5);
            const vehiclePool = await FleetVehicle.find({ vehicleType, isAvailable: true }).limit(count);

            selectedDriver = assignDriver(driverPool);
            selectedVehicle = assignVehicle(vehiclePool);

            if (!selectedDriver) return res.status(409).json({ message: "No online drivers available" });
            if (!selectedVehicle) return res.status(409).json({ message: `No available ${vehicleType}` });

            // Fare is distance-based; use default estimate if no geocoding
            try {
                calculatedFare = calculateFare(bookingType, {});
            } catch (e) {
                return res.status(400).json({ message: e.message });
            }
        }

        // ── 4. Persist the booking ────────────────────────────────
        const count = Number(numVehicles) || 1;
        const bookingPayload = {
            clientName,
            clientPhone,
            clientEmail,
            clientType,
            vehicleType: vehicleType || "Car",
            numVehicles: count,
            pickupLocation,
            dropLocation,
            date: new Date(date),
            bookingType,
            calculatedFare,
            assignedDriverId: selectedDriver ? selectedDriver._id : null,
            assignedVehicleId: selectedVehicle ? selectedVehicle._id : null,
        };

        // Attach DRIVER_ONLY specific fields
        if (bookingType === BOOKING_TYPES.DRIVER_ONLY) {
            bookingPayload.customerVehicleDetails = customerVehicleDetails;
            bookingPayload.hourlyRate = DEFAULT_RATES.DRIVER_ONLY_HOURLY;
            bookingPayload.durationHours = Number(durationHours);
            if (purpose) bookingPayload.purpose = purpose;
        }

        // Attach VEHICLE_ONLY specific fields
        if (bookingType === BOOKING_TYPES.VEHICLE_ONLY) {
            bookingPayload.dailyRate = DEFAULT_RATES.VEHICLE_ONLY_DAILY;
            bookingPayload.durationDays = Number(durationDays);
        }

        const booking = await FleetBooking.create(bookingPayload);

        // ── 5. Mark the assigned vehicle as unavailable ───────────
        if (selectedVehicle) {
            await FleetVehicle.findByIdAndUpdate(selectedVehicle._id, { isAvailable: false });
        }

        // ── 6. Respond ────────────────────────────────────────────
        return res.status(201).json({
            message: `${bookingType} booking created successfully`,
            booking,
            assignedDriver: selectedDriver || null,
            assignedVehicle: selectedVehicle || null,
            calculatedFare,
        });
    } catch (err) {
        console.error("createBookingV2 error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = { createBooking, getBookings, updateBookingStatus, createBookingV2, getRates };

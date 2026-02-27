const mongoose = require("mongoose");

const fleetBookingSchema = new mongoose.Schema(
    {
        clientName: {
            type: String,
            required: [true, "Client name is required"],
            trim: true,
        },
        clientPhone: {
            type: String,
            required: [true, "Client phone is required"],
            trim: true,
        },
        clientEmail: {
            type: String,
            required: [true, "Client email is required"],
            lowercase: true,
            trim: true,
        },
        clientType: {
            type: String,
            enum: {
                values: ["Company", "School", "Other"],
                message: "clientType must be Company, School, or Other",
            },
            required: [true, "Client type is required"],
        },
        vehicleType: {
            type: String,
            enum: {
                values: ["Car", "Bus", "Van"],
                message: "vehicleType must be Car, Bus, or Van",
            },
            required: [true, "Vehicle type is required"],
        },
        numVehicles: {
            type: Number,
            required: [true, "Number of vehicles is required"],
            min: [1, "Must request at least 1 vehicle"],
        },
        pickupLocation: {
            type: String,
            required: [true, "Pickup location is required"],
            trim: true,
        },
        dropLocation: {
            type: String,
            required: [true, "Drop location is required"],
            trim: true,
        },
        date: {
            type: Date,
            required: [true, "Booking date is required"],
        },
        status: {
            type: String,
            enum: ["pending", "confirmed", "cancelled"],
            default: "pending",
        },
        // ── v2 fields (all optional — existing documents remain valid) ──────

        /** Which booking mode was used. Defaults to NORMAL for backward compat. */
        bookingType: {
            type: String,
            enum: {
                values: ["NORMAL", "DRIVER_ONLY", "VEHICLE_ONLY"],
                message: "bookingType must be NORMAL, DRIVER_ONLY, or VEHICLE_ONLY",
            },
            default: "NORMAL",
        },

        /** Assigned captain (NORMAL or DRIVER_ONLY). Ref → Captain model. */
        assignedDriverId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Captain",
            default: null,
        },

        /** Single assigned vehicle for v2 (NORMAL or VEHICLE_ONLY). */
        assignedVehicleId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "FleetVehicle",
            default: null,
        },

        /** Customer's own vehicle details — required for DRIVER_ONLY. */
        customerVehicleDetails: {
            make: { type: String, trim: true },
            model: { type: String, trim: true },
            plate: { type: String, trim: true, uppercase: true },
            year: { type: Number },
        },

        // ── Pricing fields ───────────────────────────────────────────────────
        /** Per-hour rate — used for DRIVER_ONLY fare calculation. */
        hourlyRate: { type: Number, default: null },
        /** Number of hours hired — used for DRIVER_ONLY. */
        durationHours: { type: Number, default: null },

        /** Per-day rate — used for VEHICLE_ONLY fare calculation. */
        dailyRate: { type: Number, default: null },
        /** Number of days hired — used for VEHICLE_ONLY. */
        durationDays: { type: Number, default: null },

        /** Final calculated fare (set by calculateFare service). */
        calculatedFare: { type: Number, default: null },

        // ── Legacy field kept intact (original v1 flow) ──────────────────────
        assignedVehicles: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "FleetVehicle",
            },
        ],
    },
    { timestamps: true }
);

// Index for status-based filtering
fleetBookingSchema.index({ status: 1, date: -1 });

module.exports = mongoose.model("FleetBooking", fleetBookingSchema);

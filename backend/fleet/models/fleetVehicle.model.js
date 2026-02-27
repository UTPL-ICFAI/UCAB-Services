const mongoose = require("mongoose");

const fleetVehicleSchema = new mongoose.Schema(
    {
        ownerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "FleetOwner",
            required: [true, "Owner ID is required"],
        },
        vehicleType: {
            type: String,
            enum: {
                values: ["Car", "Bus", "Van"],
                message: "vehicleType must be Car, Bus, or Van",
            },
            required: [true, "Vehicle type is required"],
        },
        vehicleNumber: {
            type: String,
            required: [true, "Vehicle number is required"],
            unique: true,
            uppercase: true,
            trim: true,
        },
        driverName: {
            type: String,
            required: [true, "Driver name is required"],
            trim: true,
        },
        driverPhone: {
            type: String,
            required: [true, "Driver phone is required"],
            trim: true,
        },
        seatingCapacity: {
            type: Number,
            required: [true, "Seating capacity is required"],
            min: [1, "Capacity must be at least 1"],
        },
        isAvailable: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

// Index for querying by owner + availability
fleetVehicleSchema.index({ ownerId: 1, isAvailable: 1 });

module.exports = mongoose.model("FleetVehicle", fleetVehicleSchema);

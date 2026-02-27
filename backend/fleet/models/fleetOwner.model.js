const mongoose = require("mongoose");

const fleetOwnerSchema = new mongoose.Schema(
    {
        ownerName: {
            type: String,
            required: [true, "Owner name is required"],
            trim: true,
        },
        companyName: {
            type: String,
            required: [true, "Company name is required"],
            trim: true,
        },
        phone: {
            type: String,
            required: [true, "Phone is required"],
            unique: true,
            trim: true,
        },
        email: {
            type: String,
            required: [true, "Email is required"],
            unique: true,
            lowercase: true,
            trim: true,
        },
        address: {
            type: String,
            required: [true, "Address is required"],
            trim: true,
        },
        totalVehicles: {
            type: Number,
            required: [true, "Total vehicles count is required"],
            min: [1, "Must have at least 1 vehicle"],
        },
        isVerified: {
            type: Boolean,
            default: false,
        },
        password: {
            type: String,
            required: [true, "Password is required"],
            minlength: [6, "Password must be at least 6 characters"],
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("FleetOwner", fleetOwnerSchema);

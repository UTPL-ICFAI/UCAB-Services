const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
    {
        senderId: {
            type: String,
            required: true,
            trim: true,
        },
        receiverId: {
            type: String,
            required: true,
            trim: true,
        },
        type: {
            type: String,
            enum: ["RIDE_BOOKED", "RIDE_ACCEPTED"],
            required: true,
        },
        rideId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Ride",
            default: null,
        },
        message: {
            type: String,
            required: true,
            trim: true,
        },
        isRead: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

// Index for fast lookup by receiver
notificationSchema.index({ receiverId: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);

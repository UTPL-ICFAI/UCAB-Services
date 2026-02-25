// import mongoose //
const mongoose = require("mongoose");

// ride schema //
const rideSchema = new mongoose.Schema({
    pickup:{ // pickup location
        lat : Number,
        lng : Number,
        address: String
    },
    dropoff:{ // dropoff location
        lat : Number,
        lng : Number,
        address: String
    },
    fare: Number, // fare for the ride
    rideType: { type: String, default: "BolaCab Go" },
    captainSocketId: { type: String, default: null },
    status: { type: String, default: "requested" },
    scheduledAt:    { type: Date,   default: null },  // null = ride now
    paymentMethod:  { type: String, default: "cash" }, // cash | upi
    cancellationFee:{ type: Number, default: 0 },
    cancelledBy:    { type: String, default: null }    // user | captain
}, { timestamps: true });
module.exports = mongoose.model("Ride", rideSchema);
module.exports = mongoose.model("Ride",rideSchema);
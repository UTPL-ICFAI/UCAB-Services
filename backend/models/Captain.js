const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

const captainSchema = new mongoose.Schema({
    name:     { type: String, required: true, trim: true },
    phone:    { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    vehicle: {
        type: new mongoose.Schema({
            type:  { type: String, enum: ["go", "premier", "auto", "bike"], required: true },
            plate: { type: String, required: true, uppercase: true, trim: true },
            color: { type: String, required: true, trim: true },
            model: { type: String, required: true, trim: true },
        }, { _id: false }),
        required: true
    },
    rating:   { type: Number, default: 5.0 },
    earnings: { type: Number, default: 0 },
    totalRides: { type: Number, default: 0 },
    isOnline: { type: Boolean, default: false },
    socketId: { type: String, default: null },
}, { timestamps: true });

// Hash password before saving (Mongoose 9 async middleware — no `next`)
captainSchema.pre("save", async function() {
    if (!this.isModified("password")) return;
    this.password = await bcrypt.hash(this.password, 10);
});

// Compare password
captainSchema.methods.comparePassword = function(plain) {
    return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model("Captain", captainSchema);

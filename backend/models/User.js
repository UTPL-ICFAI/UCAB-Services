const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    name:  { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    socketId: { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);

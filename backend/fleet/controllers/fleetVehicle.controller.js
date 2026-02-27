const FleetVehicle = require("../models/fleetVehicle.model");
const FleetOwner = require("../models/fleetOwner.model");

// ── POST /api/fleet/vehicles ──────────────────────────────────
const addVehicle = async (req, res) => {
    try {
        const { ownerId, vehicleType, vehicleNumber, driverName, driverPhone, seatingCapacity } =
            req.body;

        if (!ownerId || !vehicleType || !vehicleNumber || !driverName || !driverPhone || !seatingCapacity) {
            return res.status(400).json({ message: "All vehicle fields are required" });
        }

        // Verify owner exists
        const owner = await FleetOwner.findById(ownerId);
        if (!owner) {
            return res.status(404).json({ message: "Fleet owner not found" });
        }

        // Duplicate vehicle number check
        const existing = await FleetVehicle.findOne({ vehicleNumber: vehicleNumber.toUpperCase() });
        if (existing) {
            return res.status(409).json({ message: "Vehicle with this number already exists" });
        }

        const vehicle = await FleetVehicle.create({
            ownerId,
            vehicleType,
            vehicleNumber,
            driverName,
            driverPhone,
            seatingCapacity: Number(seatingCapacity),
        });

        res.status(201).json({ message: "Vehicle added successfully", vehicle });
    } catch (err) {
        console.error("addVehicle error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// ── GET /api/fleet/vehicles?ownerId=<id>&available=true ──────
const getVehiclesByOwner = async (req, res) => {
    try {
        const { ownerId, available, vehicleType } = req.query;
        const filter = {};

        if (ownerId) filter.ownerId = ownerId;
        if (vehicleType) filter.vehicleType = vehicleType;
        if (available === "true") filter.isAvailable = true;
        if (available === "false") filter.isAvailable = false;

        const vehicles = await FleetVehicle.find(filter)
            .populate("ownerId", "ownerName companyName phone")
            .sort({ createdAt: -1 });

        res.json({ vehicles });
    } catch (err) {
        console.error("getVehiclesByOwner error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// ── PATCH /api/fleet/vehicles/:id ────────────────────────────
const updateAvailability = async (req, res) => {
    try {
        const { isAvailable } = req.body;
        if (typeof isAvailable !== "boolean") {
            return res.status(400).json({ message: "isAvailable must be a boolean" });
        }

        const vehicle = await FleetVehicle.findByIdAndUpdate(
            req.params.id,
            { isAvailable },
            { new: true }
        );
        if (!vehicle) return res.status(404).json({ message: "Vehicle not found" });

        res.json({ message: "Availability updated", vehicle });
    } catch (err) {
        console.error("updateAvailability error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = { addVehicle, getVehiclesByOwner, updateAvailability };

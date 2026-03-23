const bcrypt = require("bcryptjs");
const FleetOwner = require("../models/fleetOwner.model");

// ── POST /api/fleet/owners  (register) ───────────────────────
const registerOwner = async (req, res) => {
    try {
        const {
            ownerName, companyName, phone, email, address, totalVehicles, password,
            insuranceCert, driverLicense, ownerAadhaar,
            ownerType, gstin, businessDoc,
        } = req.body;

        if (!ownerName || !companyName || !phone || !email || !address || !totalVehicles || !password) {
            return res.status(400).json({ message: "All fields including password are required" });
        }
        if (!insuranceCert || !driverLicense || !ownerAadhaar) {
            return res.status(400).json({
                message: "Car insurance certificate, driver licence, and Aadhaar card are required",
            });
        }
        // Fleet owners must also supply GSTIN + business document
        const resolvedType = ownerType === "rental" ? "rental" : "fleet";
        if (resolvedType === "fleet" && (!gstin || !businessDoc)) {
            return res.status(400).json({ message: "GSTIN and business document are required for fleet owner registration" });
        }
        if (password.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters" });
        }
        if (isNaN(totalVehicles) || Number(totalVehicles) < 1) {
            return res.status(400).json({ message: "totalVehicles must be a positive number" });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Duplicate check scoped to the same owner type
        const existing = await FleetOwner.findOne({
            $or: [{ phone: phone.trim() }, { email: normalizedEmail }],
            ownerType: resolvedType,
        });
        if (existing) {
            const field = existing.phone === phone.trim() ? "phone" : "email";
            return res.status(409).json({ message: `A ${resolvedType} owner with this ${field} already exists` });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const owner = await FleetOwner.create({
            ownerName: ownerName.trim(),
            companyName: companyName.trim(),
            phone: phone.trim(),
            email: normalizedEmail,
            address: address.trim(),
            totalVehicles: Number(totalVehicles),
            password: hashedPassword,
            insuranceCert: insuranceCert || null,
            driverLicense: driverLicense || null,
            ownerAadhaar: ownerAadhaar || null,
            ownerType: resolvedType,
            gstin: gstin || null,
            businessDoc: businessDoc || null,
        });

        // Don't return password hash to client
        const { password: _pw, ...safeOwner } = owner;
        res.status(201).json({ message: `${resolvedType === 'rental' ? 'Rental provider' : 'Fleet owner'} registered successfully`, owner: safeOwner });
    } catch (err) {
        console.error("registerOwner error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// ── POST /api/fleet/owners/login  (email + password) ─────────
const loginOwner = async (req, res) => {
    try {
        const { email, password, ownerType } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        const resolvedType = ownerType === "rental" ? "rental" : "fleet";
        const normalizedEmail = email.toLowerCase().trim();

        // Demo credentials for rental owner
        if (normalizedEmail === "rentalowner@demo.com" && password === "demo123" && resolvedType === "rental") {
            return res.json({
                message: "Login successful",
                owner: {
                    _id: "demo_rental_owner_001",
                    email: "rentalowner@demo.com",
                    name: "Demo Rental Provider",
                    phone: "+91-98765-43210",
                    company: "Demo Rentals",
                    totalVehicles: 5,
                    ownerType: "rental",
                    verified: true,
                    _portalType: "rental",
                }
            });
        }

        // Demo credentials for fleet owner
        if (normalizedEmail === "demofleet@demo.com" && password === "demo123" && resolvedType === "fleet") {
            return res.json({
                message: "Login successful",
                owner: {
                    _id: "demo_fleet_owner_001",
                    email: "demofleet@demo.com",
                    name: "Demo Fleet Owner",
                    phone: "+91-98765-43210",
                    companyName: "Demo Fleet Services",
                    totalVehicles: 25,
                    ownerType: "fleet",
                    verified: true,
                    _portalType: "fleet",
                }
            });
        }

        // First check if *any* account exists with this email
        const ownerAny = await FleetOwner.findOne({ email: normalizedEmail });
        if (!ownerAny) {
            return res.status(404).json({ message: "No account found with this email. Please register first." });
        }

        // Reject if the account belongs to a different portal
        if (ownerAny.ownerType !== resolvedType) {
            const portalName = ownerAny.ownerType === "rental" ? "Rental Provider" : "Fleet Owner";
            return res.status(403).json({
                message: `This account is registered under the ${portalName} portal. Please use the correct login page.`,
            });
        }

        const isMatch = await bcrypt.compare(password, ownerAny.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Incorrect password" });
        }

        const { password: _pw, ...safeOwner } = ownerAny;
        res.json({ message: "Login successful", owner: safeOwner });
    } catch (err) {
        console.error("loginOwner error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// ── GET /api/fleet/owners?verified=true ──────────────────────
const getOwners = async (req, res) => {
    try {
        const filter = {};
        if (req.query.verified === "true") filter.isVerified = true;
        const owners = await FleetOwner.find(filter).select("-password").sort({ createdAt: -1 });
        res.json({ owners });
    } catch (err) {
        console.error("getOwners error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// ── PATCH /api/fleet/owners/:id/verify ───────────────────────
const verifyOwner = async (req, res) => {
    try {
        const owner = await FleetOwner.findByIdAndUpdate(
            req.params.id,
            { isVerified: true },
            { new: true }
        ).select("-password");
        if (!owner) return res.status(404).json({ message: "Fleet owner not found" });
        res.json({ message: "Owner verified", owner });
    } catch (err) {
        console.error("verifyOwner error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = { registerOwner, loginOwner, getOwners, verifyOwner };

require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const pool = require("./config/db");

const Ride = require("./models/Ride");
const Captain = require("./models/Captain");
const authRoutes = require("./routes/auth");

// ── New feature modules (additive — no existing logic changed) ─
const notificationRoutes = require("./notifications/notification.routes");
const registerNotificationSocket = require("./notifications/notification.socket");
const fleetRoutes = require("./fleet/fleet.routes");

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
    "http://localhost:3000",
    "https://ucab-service.vercel.app",
    "https://ucabservices.onrender.com",
    "https://ucab-services.onrender.com"
];

const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);

        const isAllowed = allowedOrigins.includes(origin) ||
            origin.endsWith(".vercel.app");

        if (isAllowed) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true
};

// socket.io server with reliability tuning
const io = new Server(server, {
    cors: corsOptions,
    pingInterval: 10000,
    pingTimeout: 30000,
    connectTimeout: 20000,
    transports: ["websocket", "polling"],
    upgradeTimeout: 10000,
    maxHttpBufferSize: 1e6,
});

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "ucab_secret_2026";


// ── Middleware ───────────────────────────────────────────────
app.use(cors(corsOptions));
app.use(express.json());

// ── REST routes ──────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/fleet", fleetRoutes);
app.get("/health", (_req, res) => res.json({ status: "ok", time: new Date() }));

// ── PostgreSQL + auto-migrate ────────────────────────────────
const fs = require("fs");
const path = require("path");

pool.query("SELECT 1")
    .then(() => {
        console.log("✅ PostgreSQL connected");
        return pool.query("SELECT to_regclass('public.users') AS exists");
    })
    .then(async (res) => {
        if (!res.rows[0].exists) {
            console.log("⚠️  Tables not found — running initial migration…");
        }
        // Run all migrations — each uses IF NOT EXISTS / IF NOT EXISTS so safe to re-run
        const migrationDir = path.join(__dirname, "db", "migrations");
        const files = fs.readdirSync(migrationDir).filter(f => f.endsWith(".sql")).sort();
        for (const file of files) {
            const sql = fs.readFileSync(path.join(migrationDir, file), "utf8");
            await pool.query(sql);
            console.log(`  ✅ migration: ${file}`);
        }
        console.log("✅ Database tables verified & up to date");
    })
    .catch((err) => console.error("❌ PostgreSQL error:", err.message));

// ── Socket.io auth middleware ────────────────────────────────
// Decodes JWT and attaches userId/userRole to socket.
// Non-authenticated sockets are still allowed.
io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            socket.userId = decoded.id;
            socket.userRole = decoded.role;
        } catch (_) { /* invalid token — allow anonymous */ }
    }
    next();
});

// ── Register notification socket (isolated) ───────────────────
registerNotificationSocket(io);

// ── captainId → { socketIds: Set, vehicleType, name }
// Supports multiple devices per captain
const captainSockets = new Map();

io.on("connection", (socket) => {
    console.log(`🔌 connected: ${socket.id}${socket.userId ? ` (user:${socket.userId})` : ""}`);

    // Auto-join user room so io.to("user:<id>") reaches ALL devices
    if (socket.userId) socket.join(`user:${socket.userId}`);

    // ── Captain comes online after login ────────────────────
    socket.on("captain online", async ({ token }) => {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            if (decoded.role !== "captain") return;

            const captain = await Captain.findByIdAndUpdate(
                decoded.id,
                { socketId: socket.id, isOnline: true },
                { new: true }
            );
            if (!captain) return;

            // Join vehicle-type room so ride requests are filtered correctly
            socket.join(captain.vehicle.type);
            // Join captain-specific room for targeted messages (multi-device)
            socket.join(`captain:${decoded.id}`);
            socket.join(`user:${decoded.id}`);

            socket.captainId = decoded.id;
            socket.vehicleType = captain.vehicle.type;
            socket.userId = decoded.id;

            if (!captainSockets.has(decoded.id)) {
                captainSockets.set(decoded.id, {
                    socketIds: new Set(),
                    vehicleType: captain.vehicle.type,
                    name: captain.name
                });
            }
            captainSockets.get(decoded.id).socketIds.add(socket.id);

            // Send full profile back — persists earnings/stats across refresh
            socket.emit("captain profile", {
                _id: captain._id,
                name: captain.name,
                phone: captain.phone,
                vehicle: captain.vehicle,
                rating: captain.rating,
                earnings: captain.earnings,
                totalRides: captain.totalRides
            });
            console.log(`🚗 Captain ${captain.name} [${captain.vehicle.type}] online`);
        } catch (e) {
            console.error("captain online error:", e.message);
        }
    });

    socket.on("rental provider online", (data) => {
        socket.join("rentals");
        console.log(`Rental Provider [${data.ownerId || 'unknown'}] online -> room [rentals]`);
    });

    // ── User requests a ride ─────────────────────────────────
    socket.on("new ride request", async (data) => {
        try {
            // Resolve riderId from JWT (socket.userId) or from data payload
            const riderId = socket.userId || data.userId || null;

            const ride = await Ride.create({
                pickup: data.pickup,
                dropoff: data.dropoff,
                fare: data.fare,
                rideType: data.rideType || "go",
                paymentMethod: data.paymentMethod || "cash",
                scheduledAt: data.scheduledAt || null,
                status: "requested",
                riderSocketId: socket.id,
                riderId,
                parcelWeight: data.parcelWeight || null,
                receiverName: data.receiverName || null,
                receiverPhone: data.receiverPhone || null,
            });

            // Tell rider what their rideId is so they can filter later events
            socket.emit("ride requested", { rideId: ride._id.toString() });

            // Only captains with matching vehicle type receive notification
            io.to(data.rideType || "go").emit("new ride", {
                rideId: ride._id.toString(),
                pickup: ride.pickup,
                dropoff: ride.dropoff,
                fare: ride.fare,
                rideType: ride.rideType,
                paymentMethod: ride.paymentMethod,
                scheduledAt: ride.scheduledAt,
                distKm: data.distKm,
                parcelWeight: ride.parcelWeight,
                receiverName: ride.receiverName,
                receiverPhone: ride.receiverPhone,
            });
            console.log(`📍 Ride ${ride._id} → room [${data.rideType}] (rider: ${riderId})`);
        } catch (err) {
            console.error("new ride request error:", err);
            socket.emit("ride error", { message: "Could not create ride. Please try again." });
        }
    });

    // ── Captain accepts ride — atomic single-win ──────────────
    socket.on("accept ride", async ({ rideId, captainId, captainName }) => {
        try {
            // Atomic DB update — only the first captain to run this wins
            const ride = await Ride.findOneAndUpdate(
                { _id: rideId, status: "requested" },
                { status: "accepted", captainSocketId: socket.id, captainId },
                { new: true }
            );

            if (!ride) {
                socket.emit("ride already taken", { rideId });
                return;
            }

            const captainProfile = await Captain.findOne({ socketId: socket.id })
                .catch(() => null);

            // Generate server-side OTP and store hashed version in DB
            const otp = String(Math.floor(1000 + Math.random() * 9000));
            const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
            await Ride.findByIdAndUpdate(rideId, { otp: otpHash });

            const acceptedPayload = {
                rideId: ride._id.toString(),
                captainName: captainName || captainProfile?.name || "Your Captain",
                captainSocketId: socket.id,
                captainId: captainId || captainProfile?._id?.toString() || null,
                otp,   // show OTP to rider; captain must ask rider for this code
                captain: captainProfile ? {
                    name: captainProfile.name,
                    rating: captainProfile.rating,
                    totalRides: captainProfile.totalRides,
                    vehicle: captainProfile.vehicle
                } : null
            };

            // ── Notify rider on ALL their devices via user room ───────────
            const riderId = ride.riderId;
            if (riderId) {
                io.to(`user:${riderId}`).emit("ride accepted", acceptedPayload);
            }
            // Fallback to stored socket ID if riderId is not available
            if (ride.riderSocketId) {
                io.to(ride.riderSocketId).emit("ride accepted", acceptedPayload);
            }

            // ── Broadcast to ALL captains in vehicle-type room to remove card ──
            // Use ride.rideType if available, otherwise broadcast to all
            const targetRoom = ride.rideType || "go";
            io.to(targetRoom).emit("ride accepted", {
                rideId: ride._id.toString(),
                captainName: acceptedPayload.captainName,
                captainId: acceptedPayload.captainId,
                captain: acceptedPayload.captain,
            });

            console.log(`✅ Ride ${rideId} accepted by ${captainName} (rider: ${riderId})`);
        } catch (err) {
            console.error("accept ride error:", err);
        }
    });

    // ── OTP verification — captain enters rider's OTP ────────────
    socket.on("verify otp", async ({ rideId, otp }) => {
        try {
            const ride = await Ride.findById(rideId);
            if (!ride) { socket.emit("otp result", { rideId, valid: false, reason: "Ride not found" }); return; }
            if (!ride.otp) { socket.emit("otp result", { rideId, valid: true }); return; }
            const inputHash = crypto.createHash("sha256").update(String(otp)).digest("hex");
            const valid = inputHash === ride.otp;
            socket.emit("otp result", { rideId, valid, reason: valid ? null : "Invalid OTP — please try again" });
            if (valid) console.log(`🔐 OTP verified for ride ${rideId}`);
        } catch (err) {
            console.error("verify otp error:", err.message);
        }
    });

    // ── Rider rates the captain after ride completes ─────────────
    socket.on("rate captain", async ({ captainId, rideId, rating }) => {
        try {
            if (!captainId || !rating || rating < 1 || rating > 5) return;
            const captain = await Captain.findById(captainId);
            if (!captain) return;
            const rides = Math.max(captain.totalRides || 1, 1);
            const newRating = parseFloat(
                ((captain.rating * rides + rating) / (rides + 1)).toFixed(2)
            );
            await Captain.findByIdAndUpdate(captainId, { rating: newRating });
            if (rideId) await Ride.findByIdAndUpdate(rideId, { riderRating: rating });
            console.log(`⭐ Captain ${captainId} rated ${rating} → new avg ${newRating}`);
        } catch (err) {
            console.error("rate captain error:", err.message);
        }
    });

    // ── Legacy OTP relay (backward compat) ───────────────────────
    socket.on("rider:share_otp", ({ captainSocketId, otp, rideId }) => {
        if (captainSocketId) io.to(captainSocketId).emit("captain:receive_otp", { otp, rideId });
    });

    // ── Captain completes ride ───────────────────────────────
    socket.on("complete ride", async ({ rideId, captainId, fare }) => {
        try {
            await Ride.findByIdAndUpdate(rideId, { status: "completed" });

            if (captainId) {
                const updated = await Captain.findByIdAndUpdate(
                    captainId,
                    { $inc: { earnings: fare || 0, totalRides: 1 } },
                    { new: true }
                );
                if (updated) {
                    const statsPayload = { earnings: updated.earnings, totalRides: updated.totalRides };
                    // Push to ALL captain devices
                    io.to(`captain:${captainId}`).emit("stats updated", statsPayload);
                    socket.emit("stats updated", statsPayload);
                }
            }

            // Notify rider on all their devices
            const ride = await Ride.findById(rideId).catch(() => null);
            if (ride?.riderId) {
                io.to(`user:${ride.riderId}`).emit("ride completed", { rideId });
            }
            io.emit("ride completed", { rideId });
            console.log(`🏁 Ride ${rideId} completed`);

            io.emit("ride completed", { rideId });
            console.log(`🏁 Ride ${rideId} completed`);
        } catch (err) {
            console.error("complete ride error:", err);
        }
    });

    /* ── Rental coordination ── */
    socket.on("notify:rental_booked", (data) => {
        // Broadcast to all rental providers
        io.to("rentals").emit("new rental booking", data);
        console.log(`📡 Rental booked: ${data.bookingId} -> notifying room [rentals]`);
    });

    // ── Disconnect ───────────────────────────────────────────
    socket.on("disconnect", async (reason) => {
        console.log(`❌ disconnected: ${socket.id} — ${reason || "unknown"}`);
        try {
            const captainId = socket.captainId;
            if (captainId) {
                const entry = captainSockets.get(captainId);
                if (entry) {
                    entry.socketIds.delete(socket.id);
                    if (entry.socketIds.size === 0) {
                        captainSockets.delete(captainId);
                        await Captain.findByIdAndUpdate(captainId, { isOnline: false, socketId: null });
                    }
                }
            } else {
                await Captain.findOneAndUpdate(
                    { socketId: socket.id },
                    { isOnline: false, socketId: null }
                );
                for (const [id, info] of captainSockets.entries()) {
                    if (info.socketIds?.has(socket.id)) {
                        info.socketIds.delete(socket.id);
                        if (info.socketIds.size === 0) captainSockets.delete(id);
                        break;
                    }
                }
            }
        } catch (_) { }
    });
});

// ── Start — bind to 0.0.0.0 so LAN devices can connect ──────
server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 UCab server → http://0.0.0.0:${PORT}`);
});
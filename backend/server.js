require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const pool = require("./config/db");  // PostgreSQL pool

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
    "https://ucabservices.onrender.com"
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

// socket.io server
const io = new Server(server, { cors: corsOptions });

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

// ── PostgreSQL ───────────────────────────────────────────────
pool.query("SELECT 1")
    .then(() => {
        console.log("✅ PostgreSQL connected");
        // Quick check: does the users table exist?
        return pool.query("SELECT to_regclass('public.users') AS exists");
    })
    .then(res => {
        if (!res.rows[0].exists) {
            console.error("⚠️  WARNING: Table 'users' not found. Please run the migration!");
        } else {
            console.log("✅ Database tables verified");
        }
    })
    .catch((err) => console.error("❌ PostgreSQL error:", err.message));

// ── Socket.io ────────────────────────────────────────────────
// Register notification socket (isolated — does not touch existing events)
registerNotificationSocket(io);

// Track captain sockets: captainId → { socketId, vehicleType, name }
const captainSockets = new Map();

io.on("connection", (socket) => {
    console.log("🔌 connected:", socket.id);

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
            captainSockets.set(decoded.id, {
                socketId: socket.id,
                vehicleType: captain.vehicle.type,
                name: captain.name
            });

            // Send full profile back to captain's device
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

    // ── User requests a ride ─────────────────────────────────
    socket.on("new ride request", async (data) => {
        try {
            const ride = await Ride.create({
                pickup: data.pickup,
                dropoff: data.dropoff,
                fare: data.fare,
                rideType: data.rideType || "go",
                paymentMethod: data.paymentMethod || "cash",
                scheduledAt: data.scheduledAt || null,
                status: "requested"
            });

            // Only captains with matching vehicle type receive notification
            io.to(data.rideType || "go").emit("new ride", {
                rideId: ride._id.toString(),
                pickup: ride.pickup,
                dropoff: ride.dropoff,
                fare: ride.fare,
                rideType: ride.rideType,
                paymentMethod: ride.paymentMethod,
                scheduledAt: ride.scheduledAt
            });
            console.log(`📍 Ride ${ride._id} → room [${data.rideType}]`);
        } catch (err) {
            console.error("new ride request error:", err);
        }
    });

    // ── Captain accepts ride — single-accept lock ────────────
    socket.on("accept ride", async ({ rideId, captainId, captainName }) => {
        try {
            const ride = await Ride.findOneAndUpdate(
                { _id: rideId, status: "requested" },
                { status: "accepted", captainSocketId: socket.id },
                { new: true }
            );

            if (!ride) {
                socket.emit("ride already taken");
                return;
            }

            // Broadcast to everyone: rider gets captain details, other captains remove card
            const captainProfile = await Captain.findOne({ socketId: socket.id })
                .select("name rating totalRides vehicle");

            io.emit("ride accepted", {
                rideId: ride._id.toString(),
                captainName: captainName || captainProfile?.name || "Your Captain",
                captainSocketId: socket.id,
                captain: captainProfile ? {
                    name: captainProfile.name,
                    rating: captainProfile.rating,
                    totalRides: captainProfile.totalRides,
                    vehicle: captainProfile.vehicle
                } : null
            });
            console.log(`✅ Ride ${rideId} accepted by ${captainName}`);
        } catch (err) {
            console.error("accept ride error:", err);
        }
    });

    // ── Rider shares OTP with captain (relay) ────────────────
    socket.on("rider:share_otp", ({ captainSocketId, otp, rideId }) => {
        if (captainSocketId) {
            io.to(captainSocketId).emit("captain:receive_otp", { otp, rideId });
        }
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
                // Push updated stats back to the captain
                socket.emit("stats updated", {
                    earnings: updated.earnings,
                    totalRides: updated.totalRides
                });
            }

            io.emit("ride completed", { rideId });
            console.log(`🏁 Ride ${rideId} completed`);
        } catch (err) {
            console.error("complete ride error:", err);
        }
    });

    // ── Disconnect ───────────────────────────────────────────
    socket.on("disconnect", async () => {
        console.log("❌ disconnected:", socket.id);
        try {
            await Captain.findOneAndUpdate(
                { socketId: socket.id },
                { isOnline: false, socketId: null }
            );
            for (const [id, info] of captainSockets.entries()) {
                if (info.socketId === socket.id) {
                    captainSockets.delete(id);
                    break;
                }
            }
        } catch (_) { }
    });
});

// ── Start — bind to 0.0.0.0 so LAN devices can connect ──────
server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 UCab server → http://0.0.0.0:${PORT}`);
});
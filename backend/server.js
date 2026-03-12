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
const walletRoutes = require("./wallet.routes");
const supportRoutes = require("./support.routes");
const adminRoutes = require("./admin.routes");
const carpoolRoutes = require("./carpool.routes");

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

// ── Haversine distance (km) between two lat/lng points ───────────
function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}


// ── Middleware ───────────────────────────────────────────────
app.use(cors(corsOptions));
app.use(express.json());

// ── REST routes ──────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/fleet", fleetRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/carpool", carpoolRoutes);
app.get("/health", (_req, res) => res.json({ status: "ok", time: new Date() }));

// ── In-memory: last known captain location per rideId (for tracking) ────────
const rideTracking = new Map(); // rideId -> { lat, lng, captainName, updatedAt }

// ── Public ride tracking endpoint ────────────────────────────────────────────
app.get("/api/rides/track/:shareToken", async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT r.id, r.status, r.pickup, r.dropoff, r.ride_type,
                    c.name AS captain_name, c.vehicle_model, c.vehicle_color, c.vehicle_plate
             FROM rides r LEFT JOIN captains c ON r.captain_id = c.id
             WHERE r.share_token = $1`,
            [req.params.shareToken]
        );
        if (!rows[0]) return res.status(404).json({ message: "Tracking link not found or expired" });
        const ride = rows[0];
        const loc = rideTracking.get(ride.id);
        res.json({
            rideId: ride.id,
            status: ride.status,
            pickup: ride.pickup,
            dropoff: ride.dropoff,
            rideType: ride.ride_type,
            captain: {
                name: ride.captain_name,
                vehicle: `${ride.vehicle_color || ""} ${ride.vehicle_model || ""}`.trim(),
                plate: ride.vehicle_plate,
            },
            captainLocation: loc ? { lat: loc.lat, lng: loc.lng, updatedAt: loc.updatedAt } : null,
        });
    } catch (err) {
        console.error("track error:", err.message);
        res.status(500).json({ message: "Server error" });
    }
});

// ── Surge: compute multiplier based on demand/supply ratio ───────────────────
async function computeSurge() {
    try {
        const { rows: setting } = await pool.query("SELECT multiplier, auto_surge FROM surge_settings WHERE id = 1");
        if (!setting[0]?.auto_surge) return parseFloat(setting[0]?.multiplier || 1);
        // Count pending rides vs online captains in the last 5 min
        const [{ rows: pending }, { rows: online }] = await Promise.all([
            pool.query("SELECT COUNT(*) FROM rides WHERE status='requested' AND created_at > NOW() - INTERVAL '5 minutes'"),
            pool.query("SELECT COUNT(*) FROM captains WHERE is_online = TRUE"),
        ]);
        const pCount = parseInt(pending[0].count);
        const oCount = Math.max(parseInt(online[0].count), 1);
        const ratio = pCount / oCount;
        if (ratio > 3) return 2.0;
        if (ratio > 2) return 1.5;
        if (ratio > 1) return 1.2;
        return 1.0;
    } catch { return 1.0; }
}
app.get("/api/rides/surge", async (_req, res) => {
    const multiplier = await computeSurge();
    res.json({ multiplier });
});

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
            // Join verified room if captain is verified (for intercity rides)
            if (captain.isVerified) {
                socket.join(`${captain.vehicle.type}_verified`);
            }

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
                insuranceFee: 1, // Add ₹1 insurance fee
                hasInsurance: true,
            });

            // Tell rider what their rideId is so they can filter later events
            socket.emit("ride requested", { rideId: ride._id.toString() });

            // Determine intercity: >= 50 km requires a verified captain
            const distKm =
                data.distKm ||
                (data.pickup?.lat && data.dropoff?.lat
                    ? haversineKm(data.pickup.lat, data.pickup.lng, data.dropoff.lat, data.dropoff.lng)
                    : 0);
            const isIntercity = distKm >= 50;
            const rideRoom = isIntercity
                ? `${data.rideType || "go"}_verified`
                : data.rideType || "go";

            // Only captains with matching vehicle type (and verified for intercity) receive notification
            io.to(rideRoom).emit("new ride", {
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
            console.log(`📍 Ride ${ride._id} → room [${rideRoom}]${isIntercity ? " (intercity — verified captains only)" : ""} (rider: ${riderId})`);
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
            // Emit to both base room and verified room so every captain who saw the ride
            // is informed that it has been taken.
            const targetRoom = ride.rideType || "go";
            io.to(targetRoom).emit("ride accepted", {
                rideId: ride._id.toString(),
                captainName: acceptedPayload.captainName,
                captainId: acceptedPayload.captainId,
                captain: acceptedPayload.captain,
            });
            io.to(`${targetRoom}_verified`).emit("ride accepted", {
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
            if (valid) {
                console.log(`🔐 OTP verified for ride ${rideId}`);
                // Notify rider that the ride has officially started
                const rideStartedPayload = { rideId };
                if (ride.riderId) io.to(`user:${ride.riderId}`).emit("ride:started", rideStartedPayload);
                if (ride.riderSocketId) io.to(ride.riderSocketId).emit("ride:started", rideStartedPayload);
            }
        } catch (err) {
            console.error("verify otp error:", err.message);
        }
    });

    // ── Captain sends a message to the rider ────────────────────
    socket.on("captain:message", async ({ rideId, message }) => {
        try {
            if (!message || !rideId) return;
            const ride = await Ride.findById(rideId).catch(() => null);
            const captainName = ride
                ? (await Captain.findOne({ socketId: socket.id }).catch(() => null))?.name || "Captain"
                : "Captain";
            const payload = { rideId, message: String(message).slice(0, 200), captainName, ts: Date.now() };
            if (ride?.riderId) io.to(`user:${ride.riderId}`).emit("captain:message", payload);
            if (ride?.riderSocketId) io.to(ride.riderSocketId).emit("captain:message", payload);
            console.log(`💬 Captain msg for ride ${rideId}: "${message}"`);
        } catch (err) {
            console.error("captain:message error:", err.message);
        }
    });

    // ── Rider sends a message to the captain ─────────────────────
    socket.on("user:message", async ({ rideId, message }) => {
        try {
            if (!message || !rideId) return;
            const ride = await Ride.findById(rideId).catch(() => null);
            if (!ride) return;
            const payload = { rideId, message: String(message).slice(0, 200), riderName: "Rider", ts: Date.now() };
            if (ride.captainSocketId) io.to(ride.captainSocketId).emit("user:message", payload);
            console.log(`💬 Rider msg for ride ${rideId}: "${message}"`);
        } catch (err) {
            console.error("user:message error:", err.message);
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

    // ── Captain rates the rider after ride completes (two-way rating) ────
    socket.on("rate rider", async ({ riderId, rideId, rating }) => {
        try {
            if (!riderId || !rating || rating < 1 || rating > 5) return;
            // Update ride with captain's rating
            if (rideId) {
                await pool.query(
                    "UPDATE rides SET captain_rating = $1 WHERE id = $2",
                    [rating, rideId]
                );
            }
            // Update rider's rolling average rating
            const { rows } = await pool.query(
                "SELECT rating, rating_count FROM users WHERE id = $1",
                [riderId]
            );
            if (rows[0]) {
                const prevRating = parseFloat(rows[0].rating) || 5.0;
                const prevCount = parseInt(rows[0].rating_count) || 0;
                const newCount = prevCount + 1;
                const newRating = parseFloat(
                    ((prevRating * prevCount + rating) / newCount).toFixed(2)
                );
                await pool.query(
                    "UPDATE users SET rating = $1, rating_count = $2 WHERE id = $3",
                    [newRating, newCount, riderId]
                );
                console.log(`⭐ Rider ${riderId} rated ${rating} → avg ${newRating}`);
            }
        } catch (err) {
            console.error("rate rider error:", err.message);
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

            // Award loyalty points to rider: 1 point per ₹10 spent (min 1 point)
            const ride = await Ride.findById(rideId).catch(() => null);
            if (ride?.riderId) {
                const points = Math.max(1, Math.floor((fare || 0) / 10));
                pool.query(
                    "UPDATE users SET loyalty_points = loyalty_points + $1 WHERE id = $2",
                    [points, ride.riderId]
                ).catch(() => {});
                io.to(`user:${ride.riderId}`).emit("loyalty:points_earned", { points, rideId });
                io.to(`user:${ride.riderId}`).emit("ride completed", { rideId });
            }
            io.emit("ride completed", { rideId });
            console.log(`🏁 Ride ${rideId} completed`);
        } catch (err) {
            console.error("complete ride error:", err);
        }
    });

    socket.on("sos alert", async (data) => {
        console.warn(`🚨 SOS ALERT from Ride [${data.rideId}]: Rider feels unsafe!`);
        // Persist to DB
        try {
            await pool.query(
                `INSERT INTO sos_alerts (ride_id, rider_id, captain_id, location) VALUES ($1,$2,$3,$4)`,
                [data.rideId || null, data.riderId || null, data.captainId || null, JSON.stringify(data.location || {})]
            );
        } catch (_) {}
        const payload = { rideId: data.rideId, riderId: data.riderId, captainId: data.captainId, location: data.location, timestamp: new Date() };
        io.to("admins").emit("sos notification", payload);
        // Notify the captain that the rider triggered SOS
        if (data.captainId) io.to(`captain:${data.captainId}`).emit("sos notification", payload);
    });

    // ── Captain broadcasts live location to rider ─────────────────
    socket.on("captain:location", async ({ rideId, lat, lng }) => {
        try {
            const ride = await Ride.findById(rideId).catch(() => null);
            if (!ride) return;
            // Store in memory for public tracking page
            rideTracking.set(ride.id.toString(), { lat, lng, updatedAt: Date.now() });
            const payload = { rideId, lat, lng };
            if (ride.riderId) io.to(`user:${ride.riderId}`).emit("captain:location", payload);
            if (ride.riderSocketId) io.to(ride.riderSocketId).emit("captain:location", payload);
            // Update captain's location in DB so nearby search works (throttled by client)
            if (socket.captainId) {
                pool.query(
                    "UPDATE captains SET lat = $1, lng = $2 WHERE id = $3",
                    [lat, lng, socket.captainId]
                ).catch(() => {});
            }
        } catch (err) { console.error("captain:location error:", err.message); }
    });

    // ── Captain broadcasts idle location (not on a ride, but online) ──
    socket.on("captain:idle_location", ({ lat, lng }) => {
        if (socket.captainId && lat && lng) {
            pool.query(
                "UPDATE captains SET lat = $1, lng = $2 WHERE id = $3",
                [lat, lng, socket.captainId]
            ).catch(() => {});
        }
    });

    // ── Captain signals arrival at pickup point ───────────────────────────
    socket.on("captain:arrived", async ({ rideId }) => {
        try {
            const ride = await Ride.findById(rideId).catch(() => null);
            if (!ride) return;
            const captain = await Captain.findOne({ socketId: socket.id }).catch(() => null);
            const captainName = captain?.name || "Your Captain";
            const payload = { rideId, captainName, ts: Date.now() };
            if (ride.riderId) io.to(`user:${ride.riderId}`).emit("captain:arrived", payload);
            if (ride.riderSocketId) io.to(ride.riderSocketId).emit("captain:arrived", payload);
            // Log arrival
            pool.query(
                "INSERT INTO captain_arrivals (ride_id, captain_id) VALUES ($1,$2)",
                [rideId, captain?._id || null]
            ).catch(() => {});
            console.log(`📍 Captain ${captainName} arrived for ride ${rideId}`);
        } catch (err) { console.error("captain:arrived error:", err.message); }
    });

    // ── Generate / return share token for a ride (rider requests) ────────────
    socket.on("ride:share", async ({ rideId }) => {
        try {
            const existing = await pool.query("SELECT share_token FROM rides WHERE id = $1", [rideId]);
            let token = existing.rows[0]?.share_token;
            if (!token) {
                token = require("crypto").randomBytes(12).toString("hex");
                await pool.query("UPDATE rides SET share_token = $1 WHERE id = $2", [token, rideId]);
            }
            socket.emit("ride:share_token", { rideId, shareToken: token });
        } catch (err) { console.error("ride:share error:", err.message); }
    });

    // ── Bid pricing: rider submits a bid ─────────────────────────
    socket.on("ride:bid", async ({ rideId, bidPrice }) => {
        try {
            if (!rideId || !bidPrice || bidPrice < 10) return;
            await pool.query(
                `UPDATE rides SET bid_price = $1, bid_status = 'pending' WHERE id = $2`,
                [bidPrice, rideId]
            );
            const ride = await Ride.findById(rideId).catch(() => null);
            if (!ride) return;
            // Broadcast updated bid to all captains in the vehicle room
            const rideRoom = ride.rideType || "go";
            io.to(rideRoom).emit("ride:bid_updated", { rideId, bidPrice, bidStatus: "pending" });
            console.log(`💰 Bid ₹${bidPrice} placed on ride ${rideId}`);
        } catch (err) { console.error("ride:bid error:", err.message); }
    });

    // ── Bid pricing: captain accepts / counters rider's bid ───────
    socket.on("ride:bid_respond", async ({ rideId, action, counterPrice }) => {
        try {
            // action: 'accept' | 'counter' | 'reject'
            if (!rideId || !action) return;
            const bidStatus = action === "accept" ? "accepted" : action === "counter" ? "countered" : "rejected";
            const updateFields = { bid_status: bidStatus };
            if (action === "counter" && counterPrice) updateFields.bid_counter_price = counterPrice;
            await pool.query(
                `UPDATE rides SET bid_status = $1, bid_counter_price = $2 WHERE id = $3`,
                [bidStatus, counterPrice || null, rideId]
            );
            const ride = await Ride.findById(rideId).catch(() => null);
            if (!ride) return;
            const payload = { rideId, action, bidStatus, counterPrice };
            if (ride.riderId) io.to(`user:${ride.riderId}`).emit("ride:bid_response", payload);
            if (ride.riderSocketId) io.to(ride.riderSocketId).emit("ride:bid_response", payload);
            console.log(`💰 Bid ${action} for ride ${rideId}`);
        } catch (err) { console.error("ride:bid_respond error:", err.message); }
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
const { createNotification } = require("./notification.controller");

/**
 * registerNotificationSocket(io)
 *
 * Enhanced notification system with better delivery tracking and debugging
 */
const registerNotificationSocket = (io) => {
    // Map userId → socketId for targeted delivery
    const userSocketMap = new Map();
    
    // Track delivery status
    const deliveryLog = new Map();

    io.on("connection", (socket) => {
        console.log(`[NOTIF] Socket connected: ${socket.id}`);

        // ── Client registers its userId so we can target it ──────
        socket.on("notification:register", ({ userId }) => {
            if (userId) {
                const prevSocket = userSocketMap.get(String(userId));
                userSocketMap.set(String(userId), socket.id);
                console.log(`[NOTIF] User ${userId} registered with socket ${socket.id}${prevSocket ? ` (prev: ${prevSocket})` : ""}`);
                
                // Emit confirmation back to client
                socket.emit("notification:registered", { userId, socketId: socket.id });
            }
        });

        // ── Rider booked a ride → notify captain ─────────────────
        socket.on("notify:ride_booked", async ({ senderId, receiverId, rideId }) => {
            try {
                const notification = await createNotification({
                    senderId: String(senderId),
                    receiverId: String(receiverId),
                    type: "RIDE_BOOKED",
                    rideId,
                    message: "A new ride has been booked near you.",
                });

                if (!notification) {
                    console.warn(`[NOTIF] Failed to create notification for ride ${rideId}`);
                    return;
                }

                // Deliver to captain if they are connected
                const captainSocketId = userSocketMap.get(String(receiverId));
                if (captainSocketId) {
                    io.to(captainSocketId).emit("notification:new", { notification });
                    console.log(`[NOTIF] ✅ Delivered ride_booked to captain ${receiverId}`);
                } else {
                    console.warn(`[NOTIF] ⚠️ Captain ${receiverId} not connected (stored in DB)`);
                }
            } catch (err) {
                console.error("notify:ride_booked error:", err.message);
            }
        });

        // ── Captain accepted → notify rider ──────────────────────
        socket.on("notify:ride_accepted", async ({ senderId, receiverId, rideId, captainName }) => {
            try {
                const notification = await createNotification({
                    senderId: String(senderId),
                    receiverId: String(receiverId),
                    type: "RIDE_ACCEPTED",
                    rideId,
                    message: `Your ride has been accepted by ${captainName || "a captain"}.`,
                });

                if (!notification) {
                    console.warn(`[NOTIF] Failed to create notification for ride ${rideId}`);
                    return;
                }

                // Deliver to rider if connected
                const riderSocketId = userSocketMap.get(String(receiverId));
                if (riderSocketId) {
                    io.to(riderSocketId).emit("notification:new", { notification });
                    console.log(`[NOTIF] ✅ Delivered ride_accepted to rider ${receiverId}`);
                } else {
                    console.warn(`[NOTIF] ⚠️ Rider ${receiverId} not connected (stored in DB)`);
                }
            } catch (err) {
                console.error("notify:ride_accepted error:", err.message);
            }
        });

        // ── Test notification endpoint ──────────────────────────
        socket.on("notify:test", ({ userId, message }) => {
            const targetSocketId = userSocketMap.get(String(userId));
            if (targetSocketId) {
                io.to(targetSocketId).emit("notification:new", { 
                    notification: {
                        id: "test-" + Date.now(),
                        type: "TEST",
                        message: message || "🧪 This is a test notification",
                        createdAt: new Date().toISOString(),
                    }
                });
                console.log(`[NOTIF] Test notification sent to ${userId}`);
            } else {
                console.log(`[NOTIF] User ${userId} not connected for test`);
            }
        });

        // ── Get connected users (debug) ──────────────────────────
        socket.on("notify:debug", () => {
            const users = Array.from(userSocketMap.entries()).map(([userId, socketId]) => ({
                userId,
                socketId,
            }));
            socket.emit("notify:debug_response", { users, totalConnected: userSocketMap.size });
            console.log(`[NOTIF] Debug requested. Connected users: ${userSocketMap.size}`);
        });

        // ── Cleanup on disconnect ──────────────────────────────────
        socket.on("disconnect", () => {
            let disconnectedUserId = null;
            for (const [userId, sid] of userSocketMap.entries()) {
                if (sid === socket.id) {
                    userSocketMap.delete(userId);
                    disconnectedUserId = userId;
                    break;
                }
            }
            console.log(`[NOTIF] Socket ${socket.id} disconnected${disconnectedUserId ? ` (user: ${disconnectedUserId})` : ""}`);
        });

        // ── Handle errors ───────────────────────────────────────
        socket.on("error", (error) => {
            console.error(`[NOTIF] Socket error on ${socket.id}:`, error);
        });
    });
};

module.exports = registerNotificationSocket;


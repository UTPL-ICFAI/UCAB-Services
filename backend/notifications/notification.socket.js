const { createNotification } = require("./notification.controller");

/**
 * registerNotificationSocket(io)
 *
 * Registers isolated socket events for the notification system.
 * Called once from server.js — does NOT interfere with existing
 * ride booking / captain socket events.
 *
 * Events listened (client → server):
 *   notify:ride_booked   { senderId, receiverId, rideId, captainSocketId? }
 *   notify:ride_accepted { senderId, receiverId, rideId, captainName }
 *
 * Events emitted (server → client):
 *   notification:new     { notification }   (to receiverId's socket)
 */
const registerNotificationSocket = (io) => {
    // Map userId → socketId for targeted delivery
    const userSocketMap = new Map();

    io.on("connection", (socket) => {
        // ── Client registers its userId so we can target it ──────
        socket.on("notification:register", ({ userId }) => {
            if (userId) {
                userSocketMap.set(String(userId), socket.id);
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

                if (!notification) return;

                // Deliver to captain if they are connected
                const captainSocketId = userSocketMap.get(String(receiverId));
                if (captainSocketId) {
                    io.to(captainSocketId).emit("notification:new", { notification });
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

                if (!notification) return;

                // Deliver to rider if connected
                const riderSocketId = userSocketMap.get(String(receiverId));
                if (riderSocketId) {
                    io.to(riderSocketId).emit("notification:new", { notification });
                }
            } catch (err) {
                console.error("notify:ride_accepted error:", err.message);
            }
        });

        // ── Cleanup on disconnect ──────────────────────────────────
        socket.on("disconnect", () => {
            for (const [userId, sid] of userSocketMap.entries()) {
                if (sid === socket.id) {
                    userSocketMap.delete(userId);
                    break;
                }
            }
        });
    });
};

module.exports = registerNotificationSocket;

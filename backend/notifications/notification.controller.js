const Notification = require("./notification.model");

// ── Internal helper — used by socket module ──────────────────
const createNotification = async ({ senderId, receiverId, type, rideId, message }) => {
    try {
        const notification = await Notification.create({
            senderId,
            receiverId,
            type,
            rideId: rideId || null,
            message,
        });
        return notification;
    } catch (err) {
        console.error("createNotification error:", err.message);
        return null;
    }
};

// ── GET /api/notifications?userId=<id>&limit=20 ──────────────
const getNotifications = async (req, res) => {
    try {
        const { userId, limit = 20 } = req.query;
        if (!userId) {
            return res.status(400).json({ message: "userId query param is required" });
        }

        const notifications = await Notification.find({ receiverId: userId })
            .sort({ createdAt: -1 })
            .limit(Number(limit));

        const unreadCount = await Notification.countDocuments({
            receiverId: userId,
            isRead: false,
        });

        res.json({ notifications, unreadCount });
    } catch (err) {
        console.error("getNotifications error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// ── PATCH /api/notifications/:id/read ────────────────────────
const markRead = async (req, res) => {
    try {
        const { id } = req.params;
        const notification = await Notification.findByIdAndUpdate(
            id,
            { isRead: true },
            { new: true }
        );
        if (!notification) {
            return res.status(404).json({ message: "Notification not found" });
        }
        res.json({ notification });
    } catch (err) {
        console.error("markRead error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// ── PATCH /api/notifications/read-all?userId=<id> ────────────
const markAllRead = async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) {
            return res.status(400).json({ message: "userId query param is required" });
        }
        await Notification.updateMany({ receiverId: userId, isRead: false }, { isRead: true });
        res.json({ message: "All notifications marked as read" });
    } catch (err) {
        console.error("markAllRead error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = { createNotification, getNotifications, markRead, markAllRead };

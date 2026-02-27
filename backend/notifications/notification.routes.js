const express = require("express");
const {
    getNotifications,
    markRead,
    markAllRead,
} = require("./notification.controller");

const router = express.Router();

// GET  /api/notifications?userId=<id>&limit=20
router.get("/", getNotifications);

// PATCH /api/notifications/read-all?userId=<id>
router.patch("/read-all", markAllRead);

// PATCH /api/notifications/:id/read
router.patch("/:id/read", markRead);

module.exports = router;

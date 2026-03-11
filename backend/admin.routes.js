/**
 * admin.routes.js
 * Admin dashboard REST API — all routes require admin secret header.
 */
const express = require("express");
const pool = require("./config/db");
const router = express.Router();

const ADMIN_SECRET = process.env.ADMIN_SECRET || "ucab_admin_2026";

// Simple admin auth middleware (header: x-admin-secret)
const adminAuth = (req, res, next) => {
    const secret = req.headers["x-admin-secret"] || req.query.secret;
    if (!secret || secret !== ADMIN_SECRET) return res.status(401).json({ message: "Unauthorized" });
    next();
};

// ============================================================
//  GET /api/admin/stats  — dashboard overview numbers
// ============================================================
router.get("/stats", adminAuth, async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [ridesTotal, ridesToday, revenue, activeCapt, totalUsers, pendingTickets, pendingWithdrawals] =
            await Promise.all([
                pool.query("SELECT COUNT(*) FROM rides WHERE status = 'completed'"),
                pool.query("SELECT COUNT(*) FROM rides WHERE status = 'completed' AND created_at >= $1", [today]),
                pool.query("SELECT COALESCE(SUM(fare),0) AS rev FROM rides WHERE status='completed' AND created_at >= $1", [today]),
                pool.query("SELECT COUNT(*) FROM captains WHERE is_online = TRUE"),
                pool.query("SELECT COUNT(*) FROM users"),
                pool.query("SELECT COUNT(*) FROM support_tickets WHERE status = 'open'"),
                pool.query("SELECT COUNT(*) FROM captain_wallets WHERE withdrawal_status = 'pending'").catch(() => ({ rows: [{ count: 0 }] })),
            ]);

        res.json({
            ridesTotal: parseInt(ridesTotal.rows[0].count),
            ridesToday: parseInt(ridesToday.rows[0].count),
            revenueToday: parseFloat(revenue.rows[0].rev),
            activeCaptains: parseInt(activeCapt.rows[0].count),
            totalUsers: parseInt(totalUsers.rows[0].count),
            pendingTickets: parseInt(pendingTickets.rows[0].count),
            pendingWithdrawals: parseInt(pendingWithdrawals.rows[0].count),
        });
    } catch (err) {
        console.error("admin/stats error:", err.message);
        res.status(500).json({ message: "Server error" });
    }
});

// ============================================================
//  GET /api/admin/rides  — recent rides (last 50)
// ============================================================
router.get("/rides", adminAuth, async (req, res) => {
    try {
        const { status, limit = 50 } = req.query;
        const allowed = ["requested", "accepted", "completed", "cancelled"];
        let query, params;
        if (status && allowed.includes(status)) {
            query = `SELECT r.id, r.pickup, r.dropoff, r.fare, r.ride_type, r.status,
                    r.payment_method, r.created_at,
                    u.name AS rider_name, u.phone AS rider_phone,
                    c.name AS captain_name, c.phone AS captain_phone
             FROM rides r
             LEFT JOIN users u ON r.rider_id = u.id
             LEFT JOIN captains c ON r.captain_id = c.id
             WHERE r.status = $1
             ORDER BY r.created_at DESC LIMIT $2`;
            params = [status, Number(limit)];
        } else {
            query = `SELECT r.id, r.pickup, r.dropoff, r.fare, r.ride_type, r.status,
                    r.payment_method, r.created_at,
                    u.name AS rider_name, u.phone AS rider_phone,
                    c.name AS captain_name, c.phone AS captain_phone
             FROM rides r
             LEFT JOIN users u ON r.rider_id = u.id
             LEFT JOIN captains c ON r.captain_id = c.id
             ORDER BY r.created_at DESC LIMIT $1`;
            params = [Number(limit)];
        }
        const { rows } = await pool.query(query, params);
        res.json({ rides: rows });
    } catch (err) {
        console.error("admin/rides error:", err.message);
        res.status(500).json({ message: "Server error" });
    }
});

// ============================================================
//  GET /api/admin/captains  — all captains
// ============================================================
router.get("/captains", adminAuth, async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT id, name, phone, vehicle_type, vehicle_plate, vehicle_model,
                    rating, earnings, total_rides, is_online, is_verified, created_at
             FROM captains ORDER BY created_at DESC`
        );
        res.json({ captains: rows });
    } catch (err) { res.status(500).json({ message: "Server error" }); }
});

// ============================================================
//  PATCH /api/admin/captains/:id/verify
// ============================================================
router.patch("/captains/:id/verify", adminAuth, async (req, res) => {
    try {
        const { verified } = req.body;
        await pool.query("UPDATE captains SET is_verified = $1 WHERE id = $2", [verified !== false, req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ message: "Server error" }); }
});

// ============================================================
//  PATCH /api/admin/captains/:id/ban  — toggle active status
// ============================================================
router.patch("/captains/:id/ban", adminAuth, async (req, res) => {
    try {
        // We repurpose is_verified = false as banned for now
        await pool.query("UPDATE captains SET is_verified = FALSE WHERE id = $1", [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ message: "Server error" }); }
});

// ============================================================
//  GET /api/admin/users — all users (last 100)
// ============================================================
router.get("/users", adminAuth, async (req, res) => {
    try {
        const { rows } = await pool.query(
            "SELECT id, name, phone, email, wallet_balance, created_at FROM users ORDER BY created_at DESC LIMIT 100"
        );
        res.json({ users: rows });
    } catch (err) { res.status(500).json({ message: "Server error" }); }
});

// ============================================================
//  GET /api/admin/support-tickets
// ============================================================
router.get("/support-tickets", adminAuth, async (req, res) => {
    try {
        const { status } = req.query;
        const allowedStatuses = ["open", "in_review", "resolved", "closed"];
        let rows;
        if (status && allowedStatuses.includes(status)) {
            ({ rows } = await pool.query(
                `SELECT st.id, st.category, st.subject, st.description, st.status,
                        st.admin_note, st.created_at, u.name AS user_name, u.phone AS user_phone
                 FROM support_tickets st
                 LEFT JOIN users u ON st.user_id = u.id
                 WHERE st.status = $1
                 ORDER BY st.created_at DESC LIMIT 100`,
                [status]
            ));
        } else {
            ({ rows } = await pool.query(
                `SELECT st.id, st.category, st.subject, st.description, st.status,
                        st.admin_note, st.created_at, u.name AS user_name, u.phone AS user_phone
                 FROM support_tickets st
                 LEFT JOIN users u ON st.user_id = u.id
                 ORDER BY st.created_at DESC LIMIT 100`
            ));
        }
        res.json({ tickets: rows });
    } catch (err) { res.status(500).json({ message: "Server error" }); }
});

// ============================================================
//  PATCH /api/admin/support-tickets/:id  — update status + note
// ============================================================
router.patch("/support-tickets/:id", adminAuth, async (req, res) => {
    try {
        const { status, adminNote } = req.body;
        const allowed = ["open", "in_review", "resolved", "closed"];
        if (status && !allowed.includes(status)) return res.status(400).json({ message: "Invalid status" });
        await pool.query(
            `UPDATE support_tickets SET
               status = COALESCE($1, status),
               admin_note = COALESCE($2, admin_note),
               updated_at = NOW()
             WHERE id = $3`,
            [status || null, adminNote || null, req.params.id]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ message: "Server error" }); }
});

// ============================================================
//  GET /api/admin/withdrawals — pending withdrawal requests
// ============================================================
router.get("/withdrawals", adminAuth, async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT cw.id, cw.captain_id, cw.amount, cw.withdrawal_status, cw.created_at,
                    c.name AS captain_name, c.phone AS captain_phone
             FROM captain_wallets cw
             LEFT JOIN captains c ON cw.captain_id = c.id
             WHERE cw.withdrawal_status = 'pending'
             ORDER BY cw.created_at ASC`
        ).catch(() => ({ rows: [] }));
        res.json({ withdrawals: rows });
    } catch (err) { res.status(500).json({ message: "Server error" }); }
});

// ============================================================
//  PATCH /api/admin/withdrawals/:id  — approve or reject
// ============================================================
router.patch("/withdrawals/:id", adminAuth, async (req, res) => {
    try {
        const { action } = req.body; // 'approved' | 'rejected'
        if (!["approved", "rejected"].includes(action)) return res.status(400).json({ message: "Invalid action" });
        await pool.query(
            "UPDATE captain_wallets SET withdrawal_status = $1 WHERE id = $2",
            [action, req.params.id]
        ).catch(() => {});
        res.json({ success: true });
    } catch (err) { res.status(500).json({ message: "Server error" }); }
});

// ============================================================
//  GET /api/admin/surge — get/set surge multiplier
// ============================================================
router.get("/surge", adminAuth, async (req, res) => {
    try {
        const { rows } = await pool.query("SELECT multiplier, auto_surge FROM surge_settings WHERE id = 1");
        res.json({ multiplier: parseFloat(rows[0]?.multiplier || 1), autoSurge: rows[0]?.auto_surge ?? true });
    } catch (err) { res.status(500).json({ message: "Server error" }); }
});

router.patch("/surge", adminAuth, async (req, res) => {
    try {
        const { multiplier, autoSurge } = req.body;
        if (multiplier !== undefined && (multiplier < 1 || multiplier > 5))
            return res.status(400).json({ message: "Multiplier must be 1.0 – 5.0" });
        await pool.query(
            "UPDATE surge_settings SET multiplier = COALESCE($1, multiplier), auto_surge = COALESCE($2, auto_surge), updated_at = NOW() WHERE id = 1",
            [multiplier ?? null, autoSurge ?? null]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ message: "Server error" }); }
});

module.exports = router;

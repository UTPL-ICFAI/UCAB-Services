/**
 * support-team.routes.js
 * Support team dashboard endpoints: login, tickets, stats, live traffic
 */
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const pool = require("./config/db");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "ucab_secret_2026";

// ── Auth middleware (for support team) ────────────────────────
const supportAuth = (req, res, next) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
        req.support = jwt.verify(token, JWT_SECRET);
        if (!req.support.isSupportTeam) throw new Error("Not support team");
        next();
    } catch {
        return res.status(401).json({ error: "Invalid token" });
    }
};

// ── POST /api/support-team/login — Support team login ────────────────────
router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: "Username and password required" });
        }

        // Allow demo credentials: test/test
        if (username === "test" && password === "test") {
            const token = jwt.sign(
                {
                    id: "demo_support_team",
                    username: "test",
                    role: "supervisor",
                    isSupportTeam: true,
                },
                JWT_SECRET,
                { expiresIn: "24h" }
            );

            return res.json({
                token,
                team: {
                    id: "demo_support_team",
                    username: "test",
                    name: "Demo Support Team",
                    role: "supervisor",
                },
            });
        }

        // Try database lookup for production users
        const { rows } = await pool.query(
            "SELECT * FROM support_team WHERE username = $1 AND status = 'active'",
            [username]
        );

        if (!rows.length) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const team = rows[0];
        
        let isValid = false;
        if (team.password_hash) {
            isValid = await bcrypt.compare(password, team.password_hash);
        }

        if (!isValid) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const token = jwt.sign(
            {
                id: team.id,
                username: team.username,
                role: team.role,
                isSupportTeam: true,
            },
            JWT_SECRET,
            { expiresIn: "24h" }
        );

        res.json({
            token,
            team: {
                id: team.id,
                username: team.username,
                name: team.name,
                role: team.role,
            },
        });
    } catch (err) {
        console.error("POST /api/support-team/login error:", err.message);
        res.status(500).json({ error: "Server error" });
    }
});

// ── GET /api/support-team/tickets — Get all support tickets ───────────────────
router.get("/tickets", supportAuth, async (req, res) => {
    try {
        const { status, category, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT st.*, u.name as user_name, u.phone as user_phone, 
                   r.ride_type, r.status as ride_status
            FROM support_tickets st
            LEFT JOIN users u ON st.user_id = u.id
            LEFT JOIN rides r ON st.ride_id = r.id
            WHERE 1=1
        `;
        const params = [];

        if (status) {
            params.push(status);
            query += ` AND st.status = $${params.length}`;
        }

        if (category) {
            params.push(category);
            query += ` AND st.category = $${params.length}`;
        }

        query += ` ORDER BY st.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const { rows } = await pool.query(query, params);

        // Get total count
        let countQuery = "SELECT COUNT(*) FROM support_tickets WHERE 1=1";
        const countParams = [];
        
        if (status) {
            countParams.push(status);
            countQuery += ` AND status = $${countParams.length}`;
        }
        if (category) {
            countParams.push(category);
            countQuery += ` AND category = $${countParams.length}`;
        }

        const countResult = await pool.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].count);

        res.json({
            tickets: rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (err) {
        console.error("GET /api/support-team/tickets error:", err.message);
        res.status(500).json({ error: "Server error" });
    }
});

// ── GET /api/support-team/ticket/:id — Get ticket details ────────────────────
router.get("/ticket/:id", supportAuth, async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT st.*, u.name as user_name, u.phone as user_phone, u.email as user_email,
                    r.ride_type, r.status as ride_status, r.pickup, r.dropoff
             FROM support_tickets st
             LEFT JOIN users u ON st.user_id = u.id
             LEFT JOIN rides r ON st.ride_id = r.id
             WHERE st.id = $1`,
            [req.params.id]
        );

        if (!rows.length) {
            return res.status(404).json({ error: "Ticket not found" });
        }

        res.json({ ticket: rows[0] });
    } catch (err) {
        console.error("GET /api/support-team/ticket error:", err.message);
        res.status(500).json({ error: "Server error" });
    }
});

// ── PUT /api/support-team/ticket/:id/status — Update ticket status ──────────
router.put("/ticket/:id/status", supportAuth, async (req, res) => {
    try {
        const { status, adminNote } = req.body;

        if (!status || !["open", "in_review", "resolved", "closed"].includes(status)) {
            return res.status(400).json({ error: "Invalid status" });
        }

        const { rows } = await pool.query(
            `UPDATE support_tickets 
             SET status = $1, admin_note = COALESCE($2, admin_note), updated_at = NOW()
             WHERE id = $3
             RETURNING *`,
            [status, adminNote || null, req.params.id]
        );

        if (!rows.length) {
            return res.status(404).json({ error: "Ticket not found" });
        }

        res.json({ ticket: rows[0], message: "✅ Ticket updated" });
    } catch (err) {
        console.error("PUT /api/support-team/ticket/status error:", err.message);
        res.status(500).json({ error: "Server error" });
    }
});

// ── GET /api/support-team/live-rides — Get live ride traffic (glance view) ────
router.get("/live-rides", supportAuth, async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT 
                COUNT(*) as total_rides,
                SUM(CASE WHEN status = 'ongoing' THEN 1 ELSE 0 END) as ongoing_rides,
                SUM(CASE WHEN status = 'searching' THEN 1 ELSE 0 END) as searching_rides,
                SUM(CASE WHEN ride_type = 'carpool' THEN 1 ELSE 0 END) as carpool_rides,
                SUM(CASE WHEN ride_type = 'courier' THEN 1 ELSE 0 END) as courier_rides,
                AVG(CASE WHEN status = 'ongoing' THEN fare ELSE NULL END) as avg_fare_ongoing
             FROM rides
             WHERE created_at > NOW() - INTERVAL '24 hours'`
        );

        res.json({ traffic: rows[0] || {} });
    } catch (err) {
        console.error("GET /api/support-team/live-rides error:", err.message);
        res.status(500).json({ error: "Server error" });
    }
});

// ── GET /api/support-team/stats — Get database stats ──────────────────────────
router.get("/stats", supportAuth, async (req, res) => {
    try {
        const statsResults = await Promise.all([
            // Total users
            pool.query("SELECT COUNT(*) as count FROM users"),
            // Total captains
            pool.query("SELECT COUNT(*) as count FROM captains"),
            // Total registered vehicles
            pool.query("SELECT COUNT(*) as count FROM fleet_vehicles"),
            // Total rides (last 30 days)
            pool.query("SELECT COUNT(*) as count FROM rides WHERE created_at > NOW() - INTERVAL '30 days'"),
            // Open support tickets
            pool.query("SELECT COUNT(*) as count FROM support_tickets WHERE status IN ('open', 'in_review')"),
            // Total fleet owners
            pool.query("SELECT COUNT(*) as count FROM fleet_owners WHERE owner_type = 'fleet'"),
            // Total rental providers
            pool.query("SELECT COUNT(*) as count FROM fleet_owners WHERE owner_type = 'rental'"),
        ]);

        res.json({
            stats: {
                totalUsers: parseInt(statsResults[0].rows[0].count),
                totalCaptains: parseInt(statsResults[1].rows[0].count),
                totalVehicles: parseInt(statsResults[2].rows[0].count),
                ridesLast30Days: parseInt(statsResults[3].rows[0].count),
                openTickets: parseInt(statsResults[4].rows[0].count),
                fleetOwners: parseInt(statsResults[5].rows[0].count),
                rentalProviders: parseInt(statsResults[6].rows[0].count),
            },
        });
    } catch (err) {
        console.error("GET /api/support-team/stats error:", err.message);
        res.status(500).json({ error: "Server error" });
    }
});

// ── Initialize default support team credentials ────────────────────────────────
router.post("/init-default", async (req, res) => {
    try {
        // Check if default user exists
        const { rows } = await pool.query(
            "SELECT * FROM support_team WHERE username = 'test'"
        );

        if (rows.length) {
            return res.json({ message: "Default support team user already exists" });
        }

        // Hash password "test"
        const hashedPassword = await bcrypt.hash("test", 10);

        await pool.query(
            `INSERT INTO support_team (username, password_hash, name, role, status)
             VALUES ('test', $1, 'Test Support', 'supervisor', 'active')`,
            [hashedPassword]
        );

        res.json({ message: "✅ Default support team user created (username: test, password: test)" });
    } catch (err) {
        console.error("POST /api/support-team/init-default error:", err.message);
        res.status(500).json({ error: "Server error" });
    }
});

// ── GET /api/support-team/demo-credentials — Get demo credentials ──
router.get("/demo-credentials", async (req, res) => {
    try {
        res.json({
            demoSupportTeam: {
                username: "test",
                password: "test",
                role: "supervisor",
                name: "Demo Support Team",
                email: "support@demo.ucab.com",
            },
            features: {
                tickets: "View and manage customer support tickets from riders and captains",
                liveTraffic: "Monitor real-time ride statistics and traffic patterns",
                stats: "View database statistics including user counts, vehicle counts, etc.",
            },
            instructions: {
                access: "Go to home page → Select 'I'm in Support Team' → Login with demo credentials",
                loginPath: "/login/support",
                dashboardPath: "/support/dashboard",
                features: [
                    "View all support tickets with filtering",
                    "Update ticket status (open → in_review → resolved → closed)",
                    "Add admin notes to tickets",
                    "Monitor live ride traffic (24-hour window)",
                    "View comprehensive database statistics",
                    "Pagination support for ticket management"
                ]
            }
        });
    } catch (err) {
        console.error("GET /api/support-team/demo-credentials error:", err.message);
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;

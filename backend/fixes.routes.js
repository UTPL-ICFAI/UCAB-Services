/**
 * fixes.routes.js
 * Critical backend fixes for wallet transfer, settlement, and support
 */

const express = require("express");
const pool = require("./config/db");
const router = express.Router();

// ── Support Team Database Access ─────────────────────────────────
// GET /api/fixes/support-stats - Support team can view critical database stats
router.get("/support-stats", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) return res.status(401).json({ error: "Unauthorized" });

        // Get total rides, users, captains, revenue
        const stats = await Promise.all([
            pool.query("SELECT COUNT(*) as count FROM rides"),
            pool.query("SELECT COUNT(*) as count FROM users"),
            pool.query("SELECT COUNT(*) as count FROM captains"),
            pool.query("SELECT SUM(COALESCE(wallet_balance, 0)) as total FROM users"),
            pool.query("SELECT SUM(COALESCE(wallet_balance, 0)) as total FROM captains"),
            pool.query("SELECT COUNT(*) as count FROM wallet_transactions"),
            pool.query("SELECT SUM(amount) as total FROM wallet_transactions WHERE type = 'credit'"),
        ]);

        res.json({
            total_rides: parseInt(stats[0].rows[0].count),
            total_users: parseInt(stats[1].rows[0].count),
            total_captains: parseInt(stats[2].rows[0].count),
            users_wallet_total: parseFloat(stats[3].rows[0].total || 0),
            captains_wallet_total: parseFloat(stats[4].rows[0].total || 0),
            wallet_transactions: parseInt(stats[5].rows[0].count),
            total_credit_amount: parseFloat(stats[6].rows[0].total || 0)
        });
    } catch (err) {
        console.error("Support stats error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── Rental Provider Settlement ─────────────────────────────────
// GET /api/fixes/rental-providers - Support can see all rental providers
router.get("/rental-providers", async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT id, owner_name, email, company_name, wallet_balance, created_at 
             FROM fleet_owners 
             ORDER BY created_at DESC`
        );
        res.json({ providers: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/fixes/rental-earnings/:ownerId - See rental earnings for a provider
router.get("/rental-earnings/:ownerId", async (req, res) => {
    try {
        const { ownerId } = req.params;

        // Get all bookings for this owner
        const { rows: bookings } = await pool.query(
            `SELECT id, rider_id, vehicle_id, status, total_amount, created_at 
             FROM rental_bookings 
             WHERE owner_id = $1 
             ORDER BY created_at DESC`,
            [ownerId]
        );

        // Calculate totals
        const completed = bookings.filter(b => b.status === 'completed');
        const totalEarnings = completed.reduce((sum, b) => sum + (b.total_amount || 0), 0);

        res.json({
            total_bookings: bookings.length,
            completed_bookings: completed.length,
            total_earnings: totalEarnings,
            bookings
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/fixes/settle-rental-amount - Support settles amount to rental provider
router.post("/settle-rental-amount", async (req, res) => {
    try {
        const { ownerId, amount, bookingIds } = req.body;

        if (!ownerId || !amount || amount <= 0) {
            return res.status(400).json({ error: "Invalid ownerId or amount" });
        }

        // Credit owner's wallet
        const { rows } = await pool.query(
            `UPDATE fleet_owners 
             SET wallet_balance = COALESCE(wallet_balance, 0) + $1 
             WHERE id = $2 
             RETURNING wallet_balance`,
            [amount, ownerId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: "Provider not found" });
        }

        // Log settlement transaction
        await pool.query(
            `INSERT INTO settlement_transactions (owner_id, amount, settled_bookings, settled_at, notes)
             VALUES ($1, $2, $3, NOW(), 'Settled by support team')`,
            [ownerId, amount, JSON.stringify(bookingIds || [])]
        );

        // Update booking statuses if provided
        if (bookingIds && bookingIds.length > 0) {
            await pool.query(
                `UPDATE rental_bookings 
                 SET settlement_status = 'settled', settlement_id = NOW()::TEXT 
                 WHERE id = ANY($1)`,
                [bookingIds]
            );
        }

        res.json({
            message: "Settlement completed",
            new_balance: rows[0].wallet_balance,
            amount_settled: amount
        });
    } catch (err) {
        console.error("Settlement error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── CRITICAL: Fix Wallet Transfer ─────────────────────────────
// POST /api/fixes/verify-wallet-transfer - Debug wallet transfers
router.post("/verify-wallet-transfer", async (req, res) => {
    try {
        const { rideId } = req.body;

        // Get ride details
        const { rows: rides } = await pool.query(
            `SELECT id, rider_id, captain_id, fare, status 
             FROM rides 
             WHERE id = $1`,
            [rideId]
        );

        if (rides.length === 0) {
            return res.status(404).json({ error: "Ride not found" });
        }

        const ride = rides[0];
        const { rider_id, captain_id, fare } = ride;

        // Get both wallet balances
        const [userWallet, captainWallet] = await Promise.all([
            pool.query("SELECT wallet_balance FROM users WHERE id = $1", [rider_id]),
            pool.query("SELECT wallet_balance FROM captains WHERE id = $1", [captain_id])
        ]);

        // Get last transaction for each
        const [userTransactions, captainTransactions] = await Promise.all([
            pool.query(
                `SELECT type, amount, description, created_at 
                 FROM wallet_transactions 
                 WHERE user_id = $1 
                 ORDER BY created_at DESC 
                 LIMIT 5`,
                [rider_id]
            ),
            pool.query(
                `SELECT type, amount, description, created_at 
                 FROM captain_wallet_transactions 
                 WHERE captain_id = $1 
                 ORDER BY created_at DESC 
                 LIMIT 5`,
                [captain_id]
            )
        ]);

        res.json({
            ride: ride,
            rider_current_balance: userWallet.rows[0]?.wallet_balance || 0,
            captain_current_balance: captainWallet.rows[0]?.wallet_balance || 0,
            expected_rider_deduction: fare,
            expected_captain_credit: fare,
            rider_recent_transactions: userTransactions.rows,
            captain_recent_transactions: captainTransactions.rows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/fixes/force-wallet-transfer - Manually trigger wallet transfer
router.post("/force-wallet-transfer", async (req, res) => {
    try {
        const { rideId } = req.body;

        // Get ride
        const { rows: rides } = await pool.query(
            "SELECT id, rider_id, captain_id, fare, completed_at FROM rides WHERE id = $1",
            [rideId]
        );

        if (rides.length === 0) {
            return res.status(404).json({ error: "Ride not found" });
        }

        const ride = rides[0];
        const { rider_id, captain_id, fare } = ride;

        if (!rider_id || !captain_id || !fare || fare <= 0) {
            return res.status(400).json({ 
                error: "Invalid ride data for transfer",
                ride_data: { rider_id, captain_id, fare }
            });
        }

        console.log(`🔧 FORCE TRANSFER: Rider ${rider_id} -> Captain ${captain_id}, Amount: ₹${fare}`);

        // Deduct from rider
        const riderUpdate = await pool.query(
            `UPDATE users 
             SET wallet_balance = GREATEST(COALESCE(wallet_balance, 0) - $1, 0)
             WHERE id = $2 
             RETURNING wallet_balance, id`,
            [fare, rider_id]
        );

        console.log(`✅ Rider balance after: ₹${riderUpdate.rows[0]?.wallet_balance}`);

        // Add to captain
        const captainUpdate = await pool.query(
            `UPDATE captains 
             SET wallet_balance = COALESCE(wallet_balance, 0) + $1 
             WHERE id = $2 
             RETURNING wallet_balance, id`,
            [fare, captain_id]
        );

        console.log(`✅ Captain balance after: ₹${captainUpdate.rows[0]?.wallet_balance}`);

        // Log transactions
        await Promise.all([
            pool.query(
                `INSERT INTO wallet_transactions (user_id, type, amount, description, created_at)
                 VALUES ($1, $2, $3, $4, NOW())`,
                [rider_id, "debit", fare, `Ride completed - Force transfer for ride #${rideId}`]
            ),
            pool.query(
                `INSERT INTO captain_wallet_transactions (captain_id, type, amount, description, created_at)
                 VALUES ($1, $2, $3, $4, NOW())`,
                [captain_id, "credit", fare, `Ride completed - Force transfer from ride #${rideId}`]
            )
        ]);

        res.json({
            message: "Wallet transfer completed",
            rider_new_balance: riderUpdate.rows[0]?.wallet_balance,
            captain_new_balance: captainUpdate.rows[0]?.wallet_balance,
            transferred_amount: fare
        });
    } catch (err) {
        console.error("Force transfer error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── Fast History Update ─────────────────────────────────────
// GET /api/fixes/wallet-history/:userId - Get fast wallet history
router.get("/wallet-history/:userId", async (req, res) => {
    try {
        const { userId } = req.params;

        const { rows } = await pool.query(
            `SELECT type, amount, description, created_at 
             FROM wallet_transactions 
             WHERE user_id = $1 
             ORDER BY created_at DESC 
             LIMIT 50`,
            [userId]
        );

        res.json({
            user_id: userId,
            total_transactions: rows.length,
            transactions: rows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/fixes/captain-wallet-history/:captainId
router.get("/captain-wallet-history/:captainId", async (req, res) => {
    try {
        const { captainId } = req.params;

        const { rows } = await pool.query(
            `SELECT type, amount, description, created_at 
             FROM captain_wallet_transactions 
             WHERE captain_id = $1 
             ORDER BY created_at DESC 
             LIMIT 50`,
            [captainId]
        );

        res.json({
            captain_id: captainId,
            total_transactions: rows.length,
            transactions: rows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

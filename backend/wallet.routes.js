/**
 * wallet.routes.js
 * In-app wallet, promo codes, and captain withdrawal endpoints.
 */
const express = require("express");
const jwt = require("jsonwebtoken");
const pool = require("./config/db");
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "ucab_secret_2026";

// Simple JWT auth middleware
const auth = (req, res, next) => {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ message: "No token" });
    try {
        req.user = jwt.verify(header.replace("Bearer ", ""), JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ message: "Invalid token" });
    }
};

// ============================================================
//  GET /api/wallet/balance   — rider wallet balance + last 20 tx
// ============================================================
router.get("/balance", auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { rows: uRows } = await pool.query(
            "SELECT wallet_balance FROM users WHERE id = $1",
            [userId]
        );
        if (!uRows.length) return res.status(404).json({ message: "User not found" });

        const { rows: txRows } = await pool.query(
            `SELECT type, amount, description, created_at
             FROM wallet_transactions
             WHERE user_id = $1
             ORDER BY created_at DESC LIMIT 20`,
            [userId]
        );
        res.json({ balance: parseFloat(uRows[0].wallet_balance), transactions: txRows });
    } catch (err) {
        console.error("wallet/balance error:", err.message);
        res.status(500).json({ message: "Server error" });
    }
});

// ============================================================
//  POST /api/wallet/add   — mock top-up (no real payment gateway)
//  Body: { amount }
// ============================================================
router.post("/add", auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const amount = parseFloat(req.body.amount);
        if (!amount || amount <= 0 || amount > 10000)
            return res.status(400).json({ message: "Amount must be 1–10000" });

        const { rows } = await pool.query(
            "UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2 RETURNING wallet_balance",
            [amount, userId]
        );
        await pool.query(
            `INSERT INTO wallet_transactions (user_id, type, amount, description)
             VALUES ($1, 'credit', $2, 'Wallet top-up')`,
            [userId, amount]
        );
        res.json({ balance: parseFloat(rows[0].wallet_balance), message: `₹${amount} added to wallet` });
    } catch (err) {
        console.error("wallet/add error:", err.message);
        res.status(500).json({ message: "Server error" });
    }
});

// ============================================================
//  POST /api/wallet/apply-promo
//  Body: { code, rideAmount }
// ============================================================
router.post("/apply-promo", auth, async (req, res) => {
    try {
        const { code, rideAmount } = req.body;
        if (!code || !rideAmount) return res.status(400).json({ message: "code and rideAmount required" });

        const { rows } = await pool.query(
            `SELECT * FROM promo_codes
             WHERE code = $1 AND is_active = TRUE
               AND (expires_at IS NULL OR expires_at > NOW())
               AND (max_uses IS NULL OR used_count < max_uses)
               AND min_fare <= $2`,
            [code.toUpperCase().trim(), rideAmount]
        );

        if (!rows.length) return res.status(400).json({ message: "Invalid or expired promo code" });
        const promo = rows[0];

        let discount = promo.discount_type === "flat"
            ? parseFloat(promo.discount_value)
            : Math.round((rideAmount * parseFloat(promo.discount_value)) / 100);

        if (promo.max_discount) discount = Math.min(discount, parseFloat(promo.max_discount));
        discount = Math.min(discount, rideAmount - 1); // never make fare negative

        res.json({
            discount,
            finalAmount: Math.round(rideAmount - discount),
            message: `🎉 Promo applied! You save ₹${discount}`,
            promoId: promo.id,
        });
    } catch (err) {
        console.error("apply-promo error:", err.message);
        res.status(500).json({ message: "Server error" });
    }
});

// ============================================================
//  GET /api/wallet/captain-balance
// ============================================================
router.get("/captain-balance", auth, async (req, res) => {
    try {
        const captainId = req.user.id;
        const { rows: cRows } = await pool.query(
            "SELECT wallet_balance FROM captains WHERE id = $1",
            [captainId]
        );
        if (!cRows.length) return res.status(404).json({ message: "Captain not found" });

        const { rows: txRows } = await pool.query(
            `SELECT type, amount, description, created_at
             FROM wallet_transactions
             WHERE captain_id = $1
             ORDER BY created_at DESC LIMIT 20`,
            [captainId]
        );
        res.json({ balance: parseFloat(cRows[0].wallet_balance), transactions: txRows });
    } catch (err) {
        console.error("wallet/captain-balance error:", err.message);
        res.status(500).json({ message: "Server error" });
    }
});

// ============================================================
//  POST /api/wallet/withdrawal-request
//  Body: { amount }
// ============================================================
router.post("/withdrawal-request", auth, async (req, res) => {
    try {
        const captainId = req.user.id;
        const amount = parseFloat(req.body.amount);
        if (!amount || amount < 100)
            return res.status(400).json({ message: "Minimum withdrawal is ₹100" });

        const { rows } = await pool.query(
            "SELECT wallet_balance FROM captains WHERE id = $1",
            [captainId]
        );
        if (!rows.length) return res.status(404).json({ message: "Captain not found" });
        if (parseFloat(rows[0].wallet_balance) < amount)
            return res.status(400).json({ message: "Insufficient wallet balance" });

        await pool.query(
            "UPDATE captains SET wallet_balance = wallet_balance - $1 WHERE id = $2",
            [amount, captainId]
        );
        await pool.query(
            `INSERT INTO wallet_transactions (captain_id, type, amount, description)
             VALUES ($1, 'withdrawal_request', $2, 'Withdrawal request submitted')`,
            [captainId, amount]
        );
        res.json({ message: `₹${amount} withdrawal request submitted. Will be processed in 1–2 business days.` });
    } catch (err) {
        console.error("withdrawal-request error:", err.message);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;

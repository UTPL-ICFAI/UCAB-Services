/**
 * support.routes.js
 * Rider complaint / support ticket endpoints.
 */
const express = require("express");
const jwt = require("jsonwebtoken");
const pool = require("./config/db");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "ucab_secret_2026";

// ── Auth middleware ──────────────────────────────────────────
const auth = (req, res, next) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ error: "Invalid token" });
    }
};

// ── POST /api/support/ticket  — create a new ticket ─────────
router.post("/ticket", auth, async (req, res) => {
    try {
        const { rideId, category, subject, description } = req.body;
        if (!subject || !String(subject).trim()) {
            return res.status(400).json({ error: "Subject is required" });
        }
        // Basic length limits to prevent abuse
        const cleanDesc = String(description || "").slice(0, 2000).trim();
        const cleanSubject = String(subject).slice(0, 200).trim();
        const cleanCategory = String(category || "general").slice(0, 50);

        const { rows } = await pool.query(
            `INSERT INTO support_tickets (user_id, ride_id, category, subject, description)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, status, created_at`,
            [req.user.id, rideId || null, cleanCategory, cleanSubject, cleanDesc || null]
        );
        res.status(201).json({
            ticket: rows[0],
            message: "✅ Complaint submitted! Our team will contact you within 24 hours.",
        });
    } catch (err) {
        console.error("support/ticket error:", err.message);
        res.status(500).json({ error: "Server error" });
    }
});

// ── GET /api/support/tickets  — get user's own tickets ──────
router.get("/tickets", auth, async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT id, ride_id, category, subject, description, status, admin_note, created_at
             FROM support_tickets
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT 20`,
            [req.user.id]
        );
        res.json({ tickets: rows });
    } catch (err) {
        console.error("support/tickets error:", err.message);
        res.status(500).json({ error: "Server error" });
    }
});

// ── GET /api/support/tickets/:id — single ticket detail ─────
router.get("/tickets/:id", auth, async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT id, ride_id, category, subject, description, status, admin_note, created_at
             FROM support_tickets
             WHERE id = $1 AND user_id = $2`,
            [req.params.id, req.user.id]
        );
        if (!rows.length) return res.status(404).json({ error: "Ticket not found" });
        res.json({ ticket: rows[0] });
    } catch (err) {
        console.error("support/tickets/:id error:", err.message);
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;

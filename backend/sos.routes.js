/**
 * backend/sos.routes.js
 * Emergency SOS endpoints
 */

const express = require('express');
const pool = require('./config/db');
const { sendSOSAlertsToContacts } = require('./utils/sms');
const router = express.Router();

// Middleware: Simple auth check
const auth = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET || 'ucab_secret_2026');
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

/**
 * GET /api/sos/emergency-contacts
 * Get user's emergency contacts
 */
router.get('/emergency-contacts', auth, async (req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT emergency_contacts FROM users WHERE id = $1',
            [req.user.id]
        );

        if (!rows[0]) {
            return res.status(404).json({ error: 'User not found' });
        }

        const contacts = rows[0].emergency_contacts || [];
        res.json({ contacts });
    } catch (err) {
        console.error('Get emergency contacts error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/sos/emergency-contacts
 * Save emergency contacts
 */
router.post('/emergency-contacts', auth, async (req, res) => {
    try {
        const { contacts } = req.body; // [{ name, phone, relation }]

        if (!Array.isArray(contacts)) {
            return res.status(400).json({ error: 'Contacts must be an array' });
        }

        // Validate contacts
        const validContacts = contacts.filter(c => c.name && c.phone);
        if (validContacts.length === 0) {
            return res.status(400).json({ error: 'At least one valid contact required' });
        }

        await pool.query(
            'UPDATE users SET emergency_contacts = $1 WHERE id = $2',
            [JSON.stringify(validContacts), req.user.id]
        );

        res.json({ 
            message: '✅ Emergency contacts saved', 
            contacts: validContacts 
        });
    } catch (err) {
        console.error('Save emergency contacts error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/sos/trigger
 * Trigger SOS alert
 */
router.post('/trigger', auth, async (req, res) => {
    try {
        const { rideId, lat, lng, address } = req.body;
        const userId = req.user.id;

        if (!rideId || lat === undefined || lng === undefined) {
            return res.status(400).json({ error: 'Missing required fields: rideId, lat, lng' });
        }

        // Get user details
        const userRes = await pool.query(
            'SELECT name, emergency_contacts FROM users WHERE id = $1',
            [userId]
        );

        if (!userRes.rows[0]) {
            return res.status(404).json({ error: 'User not found' });
        }

        const riderName = userRes.rows[0].name;
        const emergencyContacts = userRes.rows[0].emergency_contacts || [];

        // Store SOS alert
        const location = {
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            address: address || 'Location coordinates available'
        };

        const sosRes = await pool.query(
            `INSERT INTO sos_alerts (ride_id, rider_id, location, status)
             VALUES ($1, $2, $3, 'active')
             RETURNING id, created_at`,
            [rideId, userId, JSON.stringify(location)]
        );

        const sosAlertId = sosRes.rows[0].id;

        // Send alerts to emergency contacts
        const smsResults = await sendSOSAlertsToContacts(
            sosAlertId,
            riderName,
            emergencyContacts,
            location,
            rideId
        );

        // Notify admin via socket (already implemented in server.js)
        // io.to("admins").emit("sos:alert", { ... })

        res.json({
            message: '🚨 SOS activated',
            sosAlertId,
            rideId,
            contactsNotified: smsResults.sent,
            contactsFailed: smsResults.failed,
            details: smsResults.results
        });

        console.log(`🚨 SOS ALERT: Rider ${riderName} (ID: ${userId}), Ride: ${rideId}`);
    } catch (err) {
        console.error('SOS trigger error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * PATCH /api/sos/:sosAlertId/cancel
 * Cancel SOS alert
 */
router.patch('/:sosAlertId/cancel', auth, async (req, res) => {
    try {
        const { sosAlertId } = req.params;

        // Verify ownership
        const sosRes = await pool.query(
            'SELECT rider_id FROM sos_alerts WHERE id = $1',
            [sosAlertId]
        );

        if (!sosRes.rows[0]) {
            return res.status(404).json({ error: 'SOS alert not found' });
        }

        if (sosRes.rows[0].rider_id !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Update status
        await pool.query(
            'UPDATE sos_alerts SET status = $1 WHERE id = $2',
            ['cancelled', sosAlertId]
        );

        res.json({ message: '✅ SOS alert cancelled' });
    } catch (err) {
        console.error('Cancel SOS error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/sos/history
 * Get user's SOS alert history
 */
router.get('/history', auth, async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT id, ride_id, location, status, created_at
             FROM sos_alerts
             WHERE rider_id = $1
             ORDER BY created_at DESC
             LIMIT 20`,
            [req.user.id]
        );

        res.json({ alerts: rows });
    } catch (err) {
        console.error('SOS history error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

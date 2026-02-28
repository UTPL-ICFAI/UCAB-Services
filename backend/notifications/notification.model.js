/**
 * notifications/notification.model.js  (PostgreSQL — raw pg)
 * Same API as the original Mongoose model.
 *
 * DB table: notifications
 */

const pool = require("../config/db");

// ── Internal helper: map DB row → Mongoose-like shape ───────────
const toDoc = (row) => {
    if (!row) return null;
    return {
        _id: row.id,
        id: row.id,
        senderId: row.sender_id,
        receiverId: row.receiver_id,
        type: row.type,
        rideId: row.ride_id,
        message: row.message,
        isRead: row.is_read,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
};

const Notification = {
    // create({ senderId, receiverId, type, rideId, message })
    async create(data) {
        const { rows } = await pool.query(
            `INSERT INTO notifications (sender_id, receiver_id, type, ride_id, message)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [
                data.senderId,
                data.receiverId,
                data.type,
                data.rideId || null,
                data.message,
            ]
        );
        return toDoc(rows[0]);
    },

    // find({ receiverId }).sort({ createdAt: -1 }).limit(n)
    find(filter = {}) {
        const conditions = [];
        const values = [];
        let i = 1;

        if (filter.receiverId !== undefined) {
            conditions.push(`receiver_id = $${i++}`);
            values.push(filter.receiverId);
        }
        if (filter.isRead !== undefined) {
            conditions.push(`is_read = $${i++}`);
            values.push(filter.isRead);
        }

        const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

        const builder = {
            _limit: null,
            sort(_s) { return this; },
            limit(n) { this._limit = n; return this; },
            async then(resolve, reject) {
                try {
                    const limitClause = builder._limit ? `LIMIT ${builder._limit}` : "";
                    const { rows } = await pool.query(
                        `SELECT * FROM notifications ${whereClause} ORDER BY created_at DESC ${limitClause}`,
                        values
                    );
                    resolve(rows.map(toDoc));
                } catch (e) {
                    reject(e);
                }
            },
        };
        return builder;
    },

    // countDocuments({ receiverId, isRead: false })
    async countDocuments(filter = {}) {
        const conditions = [];
        const values = [];
        let i = 1;

        if (filter.receiverId !== undefined) {
            conditions.push(`receiver_id = $${i++}`);
            values.push(filter.receiverId);
        }
        if (filter.isRead !== undefined) {
            conditions.push(`is_read = $${i++}`);
            values.push(filter.isRead);
        }

        const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
        const { rows } = await pool.query(
            `SELECT COUNT(*) AS count FROM notifications ${whereClause}`,
            values
        );
        return parseInt(rows[0].count, 10);
    },

    // findByIdAndUpdate(id, { isRead: true }, { new: true })
    async findByIdAndUpdate(id, update, _opts = {}) {
        const fields = [];
        const values = [];
        let i = 1;

        if (update.isRead !== undefined) { fields.push(`is_read = $${i++}`); values.push(update.isRead); }

        if (!fields.length) {
            const { rows } = await pool.query(
                "SELECT * FROM notifications WHERE id = $1", [id]
            );
            return toDoc(rows[0]);
        }

        fields.push(`updated_at = NOW()`);
        values.push(id);

        const { rows } = await pool.query(
            `UPDATE notifications SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`,
            values
        );
        return toDoc(rows[0]);
    },

    // updateMany({ receiverId, isRead: false }, { isRead: true })
    async updateMany(filter, update) {
        const conditions = [];
        const values = [];
        let i = 1;

        if (filter.receiverId !== undefined) {
            conditions.push(`receiver_id = $${i++}`);
            values.push(filter.receiverId);
        }
        if (filter.isRead !== undefined) {
            conditions.push(`is_read = $${i++}`);
            values.push(filter.isRead);
        }

        const setFields = [];
        if (update.isRead !== undefined) { setFields.push(`is_read = $${i++}`); values.push(update.isRead); }
        setFields.push(`updated_at = NOW()`);

        const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

        const { rowCount } = await pool.query(
            `UPDATE notifications SET ${setFields.join(", ")} ${whereClause}`,
            values
        );
        return { modifiedCount: rowCount };
    },
};

module.exports = Notification;

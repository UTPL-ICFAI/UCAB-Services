/**
 * models/User.js  (PostgreSQL — raw pg)
 * Exposes the same API as the Mongoose model so all callers are unchanged.
 *
 * DB table: users
 * Columns : id, name, phone, socket_id, created_at, updated_at
 *
 * Column → JS field mapping (snake_case → camelCase + _id alias)
 *   id         → _id  (Mongoose used _id; controllers rely on this)
 *   socket_id  → socketId
 */

const pool = require("../config/db");

// ── Internal helper: map DB row → Mongoose-like shape ───────────
const toDoc = (row) => {
    if (!row) return null;
    return {
        _id: row.id,
        id: row.id,
        name: row.name,
        phone: row.phone,
        socketId: row.socket_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
};

const User = {
    // findOne({ phone }) or findOne({ _id })
    async findOne(filter = {}) {
        if (filter.phone) {
            const { rows } = await pool.query(
                "SELECT * FROM users WHERE phone = $1 LIMIT 1",
                [filter.phone]
            );
            return toDoc(rows[0]);
        }
        if (filter._id || filter.id) {
            const id = filter._id || filter.id;
            const { rows } = await pool.query(
                "SELECT * FROM users WHERE id = $1 LIMIT 1",
                [id]
            );
            return toDoc(rows[0]);
        }
        return null;
    },

    // create({ name, phone })
    async create(data) {
        const { rows } = await pool.query(
            `INSERT INTO users (name, phone)
             VALUES ($1, $2)
             RETURNING *`,
            [data.name, data.phone]
        );
        return toDoc(rows[0]);
    },

    // findByIdAndUpdate(id, { socketId, isOnline }, { new: true })
    async findByIdAndUpdate(id, update, _opts = {}) {
        const fields = [];
        const values = [];
        let i = 1;

        if (update.socketId !== undefined) { fields.push(`socket_id = $${i++}`); values.push(update.socketId); }
        if (update.name !== undefined) { fields.push(`name = $${i++}`); values.push(update.name); }
        if (!fields.length) return null;

        fields.push(`updated_at = NOW()`);
        values.push(id);

        const { rows } = await pool.query(
            `UPDATE users SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`,
            values
        );
        return toDoc(rows[0]);
    },
};

module.exports = User;

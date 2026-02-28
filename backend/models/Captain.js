/**
 * models/Captain.js  (PostgreSQL — raw pg)
 * Preserves the same API as the original Mongoose model.
 *
 * DB table: captains
 * Vehicle sub-document mapped to flat columns:
 *   vehicle_type, vehicle_plate, vehicle_color, vehicle_model
 *
 * Password hashing is handled HERE (same as Mongoose pre-save hook).
 * comparePassword kept as an instance method on returned doc objects.
 */

const pool = require("../config/db");
const bcrypt = require("bcryptjs");

// ── Internal helper: map DB row → Mongoose-like shape ───────────
const toDoc = (row) => {
    if (!row) return null;
    const doc = {
        _id: row.id,
        id: row.id,
        name: row.name,
        phone: row.phone,
        password: row.password,        // kept for comparePassword
        vehicle: {
            type: row.vehicle_type,
            plate: row.vehicle_plate,
            color: row.vehicle_color,
            model: row.vehicle_model,
        },
        rating: parseFloat(row.rating),
        earnings: parseFloat(row.earnings),
        totalRides: row.total_rides,
        isOnline: row.is_online,
        socketId: row.socket_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        // ── Instance method (Mongoose-compatible) ──────────────
        comparePassword(plain) {
            return bcrypt.compare(plain, row.password);
        },
    };
    return doc;
};

const Captain = {
    // findOne({ phone }) | findOne({ socketId })
    async findOne(filter = {}) {
        if (filter.phone) {
            const { rows } = await pool.query(
                "SELECT * FROM captains WHERE phone = $1 LIMIT 1", [filter.phone]
            );
            return toDoc(rows[0]);
        }
        if (filter.socketId || filter.socket_id) {
            const sid = filter.socketId || filter.socket_id;
            const { rows } = await pool.query(
                "SELECT * FROM captains WHERE socket_id = $1 LIMIT 1", [sid]
            );
            return toDoc(rows[0]);
        }
        return null;
    },

    // findById(id)
    async findById(id) {
        const { rows } = await pool.query(
            "SELECT * FROM captains WHERE id = $1 LIMIT 1", [id]
        );
        return toDoc(rows[0]);
    },

    // find(filter).select(fields).limit(n)
    // Returns a chainable builder so callers like Captain.find({isOnline:true}).limit(5) work
    find(filter = {}) {
        const conditions = [];
        const values = [];
        let i = 1;

        if (filter.isOnline !== undefined) {
            conditions.push(`is_online = $${i++}`);
            values.push(filter.isOnline);
        }

        const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

        // Chainable builder
        const builder = {
            _limit: null,
            _select: null,      // ignored — returned shape always same
            select(_fields) { return this; },
            limit(n) { this._limit = n; return this; },
            async then(resolve, reject) {
                try {
                    const limitClause = builder._limit ? `LIMIT ${builder._limit}` : "";
                    const { rows } = await pool.query(
                        `SELECT * FROM captains ${whereClause} ${limitClause}`,
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

    // create({ name, phone, password, vehicle })
    // Hashes password before insert (replaces Mongoose pre-save hook)
    async create(data) {
        const hashedPassword = await bcrypt.hash(data.password, 10);
        const v = data.vehicle;
        const { rows } = await pool.query(
            `INSERT INTO captains
               (name, phone, password, vehicle_type, vehicle_plate, vehicle_color, vehicle_model)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [data.name, data.phone, hashedPassword, v.type, v.plate, v.color, v.model]
        );
        return toDoc(rows[0]);
    },

    // findByIdAndUpdate(id, update, { new: true })
    async findByIdAndUpdate(id, update, _opts = {}) {
        const fields = [];
        const values = [];
        let i = 1;

        if (update.socketId !== undefined) { fields.push(`socket_id = $${i++}`); values.push(update.socketId); }
        if (update.isOnline !== undefined) { fields.push(`is_online = $${i++}`); values.push(update.isOnline); }
        if (update.earnings !== undefined) { fields.push(`earnings = $${i++}`); values.push(update.earnings); }
        if (update.totalRides !== undefined) { fields.push(`total_rides = $${i++}`); values.push(update.totalRides); }

        // Handle $inc: { earnings: fare, totalRides: 1 }
        if (update.$inc) {
            if (update.$inc.earnings !== undefined) { fields.push(`earnings = earnings + $${i++}`); values.push(update.$inc.earnings); }
            if (update.$inc.totalRides !== undefined) { fields.push(`total_rides = total_rides + $${i++}`); values.push(update.$inc.totalRides); }
        }

        if (!fields.length) {
            // Nothing to update — just return current
            return this.findById(id);
        }

        fields.push(`updated_at = NOW()`);
        values.push(id);

        const { rows } = await pool.query(
            `UPDATE captains SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`,
            values
        );
        return toDoc(rows[0]);
    },

    // findOneAndUpdate(filter, update, opts) — used by socket disconnect handler
    async findOneAndUpdate(filter, update, _opts = {}) {
        // resolve id from filter
        let target = null;
        if (filter.socketId || filter.socket_id) {
            target = await this.findOne(filter);
        } else if (filter._id || filter.id) {
            target = await this.findById(filter._id || filter.id);
        }
        if (!target) return null;
        return this.findByIdAndUpdate(target._id, update, _opts);
    },
};

module.exports = Captain;

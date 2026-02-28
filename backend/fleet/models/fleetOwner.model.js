/**
 * fleet/models/fleetOwner.model.js  (PostgreSQL — raw pg)
 * Same API as the original Mongoose model.
 *
 * DB table: fleet_owners
 *
 * NOTE: Controllers call .toObject() on the returned doc from Mongoose.
 * Prisma/pg returns plain JS objects, so toObject() calls in
 * fleetOwner.controller.js are removed (only 2 lines).
 */

const pool = require("../../config/db");

// ── Internal helper: map DB row → Mongoose-like shape ───────────
const toDoc = (row) => {
    if (!row) return null;
    return {
        _id: row.id,
        id: row.id,
        ownerName: row.owner_name,
        companyName: row.company_name,
        phone: row.phone,
        email: row.email,
        address: row.address,
        totalVehicles: row.total_vehicles,
        isVerified: row.is_verified,
        password: row.password,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
};

const FleetOwner = {
    // findOne({ $or: [{ phone }, { email }] }) or { email }
    async findOne(filter = {}) {
        // $or support: { $or: [{ phone }, { email }] }
        if (filter.$or) {
            const clauses = [];
            const values = [];
            let i = 1;
            for (const cond of filter.$or) {
                if (cond.phone) { clauses.push(`phone = $${i++}`); values.push(cond.phone); }
                if (cond.email) { clauses.push(`email = $${i++}`); values.push(cond.email); }
            }
            if (!clauses.length) return null;
            const { rows } = await pool.query(
                `SELECT * FROM fleet_owners WHERE ${clauses.join(" OR ")} LIMIT 1`,
                values
            );
            return toDoc(rows[0]);
        }
        if (filter.email) {
            const { rows } = await pool.query(
                "SELECT * FROM fleet_owners WHERE email = $1 LIMIT 1", [filter.email]
            );
            return toDoc(rows[0]);
        }
        if (filter.phone) {
            const { rows } = await pool.query(
                "SELECT * FROM fleet_owners WHERE phone = $1 LIMIT 1", [filter.phone]
            );
            return toDoc(rows[0]);
        }
        return null;
    },

    // findById(id)
    async findById(id) {
        const { rows } = await pool.query(
            "SELECT * FROM fleet_owners WHERE id = $1 LIMIT 1", [id]
        );
        return toDoc(rows[0]);
    },

    // find(filter).select(fields).sort(...) — returns chainable builder
    find(filter = {}) {
        const conditions = [];
        const values = [];
        let i = 1;

        if (filter.isVerified !== undefined) {
            conditions.push(`is_verified = $${i++}`);
            values.push(filter.isVerified);
        }

        const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

        const builder = {
            _select: null,
            _sort: "created_at DESC",
            select(_f) { return this; },
            sort(_s) { return this; },
            async then(resolve, reject) {
                try {
                    const { rows } = await pool.query(
                        `SELECT * FROM fleet_owners ${whereClause} ORDER BY created_at DESC`,
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

    // create(data)
    async create(data) {
        const { rows } = await pool.query(
            `INSERT INTO fleet_owners
               (owner_name, company_name, phone, email, address, total_vehicles, password)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [
                data.ownerName,
                data.companyName,
                data.phone,
                data.email,
                data.address,
                data.totalVehicles,
                data.password,
            ]
        );
        return toDoc(rows[0]);
    },

    // findByIdAndUpdate(id, { isVerified: true }, { new: true }).select("-password")
    async findByIdAndUpdate(id, update, _opts = {}) {
        const fields = [];
        const values = [];
        let i = 1;

        if (update.isVerified !== undefined) { fields.push(`is_verified = $${i++}`); values.push(update.isVerified); }
        if (update.ownerName !== undefined) { fields.push(`owner_name = $${i++}`); values.push(update.ownerName); }

        if (!fields.length) return this.findById(id);

        fields.push(`updated_at = NOW()`);
        values.push(id);

        const { rows } = await pool.query(
            `UPDATE fleet_owners SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`,
            values
        );
        const doc = toDoc(rows[0]);
        if (doc) delete doc.password;   // mirrors .select("-password")
        return doc;
    },
};

module.exports = FleetOwner;

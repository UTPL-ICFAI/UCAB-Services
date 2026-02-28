/**
 * fleet/models/fleetVehicle.model.js  (PostgreSQL — raw pg)
 * Same API as the original Mongoose model.
 *
 * DB table: fleet_vehicles
 * FK: owner_id → fleet_owners.id
 */

const pool = require("../../config/db");

// ── Internal helper: map DB row → Mongoose-like shape ───────────
const toDoc = (row, ownerRow = null) => {
    if (!row) return null;
    return {
        _id: row.id,
        id: row.id,
        ownerId: row.owner_id,
        vehicleType: row.vehicle_type,
        vehicleNumber: row.vehicle_number,
        driverName: row.driver_name,
        driverPhone: row.driver_phone,
        seatingCapacity: row.seating_capacity,
        isAvailable: row.is_available,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        // populated owner (when joined)
        ...(ownerRow && {
            ownerId: {
                _id: ownerRow.id,
                ownerName: ownerRow.owner_name,
                companyName: ownerRow.company_name,
                phone: ownerRow.phone,
            }
        }),
    };
};

const FleetVehicle = {
    // findOne({ vehicleNumber })
    async findOne(filter = {}) {
        if (filter.vehicleNumber) {
            const { rows } = await pool.query(
                "SELECT * FROM fleet_vehicles WHERE vehicle_number = $1 LIMIT 1",
                [filter.vehicleNumber.toUpperCase()]
            );
            return toDoc(rows[0]);
        }
        return null;
    },

    // findById(id)
    async findById(id) {
        const { rows } = await pool.query(
            "SELECT * FROM fleet_vehicles WHERE id = $1 LIMIT 1", [id]
        );
        return toDoc(rows[0]);
    },

    // find(filter).populate("ownerId", "ownerName companyName phone").sort(...)
    find(filter = {}) {
        const conditions = [];
        const values = [];
        let i = 1;

        if (filter.ownerId !== undefined) { conditions.push(`fv.owner_id = $${i++}`); values.push(filter.ownerId); }
        if (filter.vehicleType !== undefined) { conditions.push(`fv.vehicle_type = $${i++}`); values.push(filter.vehicleType); }
        if (filter.isAvailable !== undefined) { conditions.push(`fv.is_available = $${i++}`); values.push(filter.isAvailable); }

        const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

        const builder = {
            _populate: false,
            _limit: null,
            populate(_field, _select) { this._populate = true; return this; },
            sort(_s) { return this; },
            limit(n) { this._limit = n; return this; },
            async then(resolve, reject) {
                try {
                    const limitClause = builder._limit ? `LIMIT ${builder._limit}` : "";
                    let rows, ownerMap = {};

                    if (builder._populate) {
                        const res = await pool.query(
                            `SELECT fv.*, fo.id AS fo_id, fo.owner_name, fo.company_name, fo.phone AS fo_phone
                             FROM fleet_vehicles fv
                             LEFT JOIN fleet_owners fo ON fv.owner_id = fo.id
                             ${whereClause}
                             ORDER BY fv.created_at DESC ${limitClause}`,
                            values
                        );
                        resolve(res.rows.map(r => {
                            const ownerRow = r.fo_id ? {
                                id: r.fo_id, owner_name: r.owner_name,
                                company_name: r.company_name, phone: r.fo_phone
                            } : null;
                            return toDoc(r, ownerRow);
                        }));
                    } else {
                        const res = await pool.query(
                            `SELECT * FROM fleet_vehicles fv ${whereClause}
                             ORDER BY created_at DESC ${limitClause}`,
                            values
                        );
                        resolve(res.rows.map(r => toDoc(r)));
                    }
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
            `INSERT INTO fleet_vehicles
               (owner_id, vehicle_type, vehicle_number, driver_name, driver_phone, seating_capacity)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [
                data.ownerId,
                data.vehicleType,
                data.vehicleNumber?.toUpperCase(),
                data.driverName,
                data.driverPhone,
                data.seatingCapacity,
            ]
        );
        return toDoc(rows[0]);
    },

    // findByIdAndUpdate(id, { isAvailable }, { new: true })
    async findByIdAndUpdate(id, update, _opts = {}) {
        const fields = [];
        const values = [];
        let i = 1;

        if (update.isAvailable !== undefined) { fields.push(`is_available = $${i++}`); values.push(update.isAvailable); }

        if (!fields.length) return this.findById(id);

        fields.push(`updated_at = NOW()`);
        values.push(id);

        const { rows } = await pool.query(
            `UPDATE fleet_vehicles SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`,
            values
        );
        return toDoc(rows[0]);
    },

    // updateMany({ _id: { $in: ids } }, { isAvailable })
    async updateMany(filter, update) {
        let ids = [];

        if (filter._id && filter._id.$in) {
            ids = filter._id.$in;
        }

        if (!ids.length) return { modifiedCount: 0 };

        const placeholders = ids.map((_, idx) => `$${idx + 2}`).join(", ");
        const { rowCount } = await pool.query(
            `UPDATE fleet_vehicles
             SET is_available = $1, updated_at = NOW()
             WHERE id IN (${placeholders})`,
            [update.isAvailable, ...ids]
        );
        return { modifiedCount: rowCount };
    },
};

module.exports = FleetVehicle;

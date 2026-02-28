/**
 * fleet/models/fleetBooking.model.js  (PostgreSQL — raw pg)
 * Same API as the original Mongoose model.
 *
 * DB table: fleet_bookings
 * FKs: assigned_driver_id → captains, assigned_vehicle_id → fleet_vehicles
 * customer_vehicle_details stored as JSONB
 * assigned_vehicles (legacy v1) stored as JSONB array of UUID strings
 */

const pool = require("../../config/db");

// ── Internal helper: map DB row → Mongoose-like shape ───────────
const toDoc = (row, populated = {}) => {
    if (!row) return null;
    return {
        _id: row.id,
        id: row.id,
        clientName: row.client_name,
        clientPhone: row.client_phone,
        clientEmail: row.client_email,
        clientType: row.client_type,
        vehicleType: row.vehicle_type,
        numVehicles: row.num_vehicles,
        pickupLocation: row.pickup_location,
        dropLocation: row.drop_location,
        date: row.date,
        status: row.status,
        bookingType: row.booking_type,
        assignedDriverId: populated.driver || row.assigned_driver_id,
        assignedVehicleId: populated.vehicle || row.assigned_vehicle_id,
        customerVehicleDetails: row.customer_vehicle_details, // parsed JSONB
        hourlyRate: row.hourly_rate !== null ? parseFloat(row.hourly_rate) : null,
        durationHours: row.duration_hours !== null ? parseFloat(row.duration_hours) : null,
        dailyRate: row.daily_rate !== null ? parseFloat(row.daily_rate) : null,
        durationDays: row.duration_days !== null ? parseFloat(row.duration_days) : null,
        calculatedFare: row.calculated_fare !== null ? parseFloat(row.calculated_fare) : null,
        assignedVehicles: row.assigned_vehicles || [],   // legacy JSONB array
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
};

const FleetBooking = {
    // create(data)
    async create(data) {
        const { rows } = await pool.query(
            `INSERT INTO fleet_bookings (
               client_name, client_phone, client_email, client_type,
               vehicle_type, num_vehicles, pickup_location, drop_location, date,
               status, booking_type,
               assigned_driver_id, assigned_vehicle_id,
               customer_vehicle_details,
               hourly_rate, duration_hours, daily_rate, duration_days, calculated_fare,
               assigned_vehicles
             ) VALUES (
               $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20
             ) RETURNING *`,
            [
                data.clientName,
                data.clientPhone,
                data.clientEmail,
                data.clientType,
                data.vehicleType || "Car",
                data.numVehicles || 1,
                data.pickupLocation,
                data.dropLocation,
                data.date,
                data.status || "pending",
                data.bookingType || "NORMAL",
                data.assignedDriverId || null,
                data.assignedVehicleId || null,
                data.customerVehicleDetails
                    ? JSON.stringify(data.customerVehicleDetails)
                    : null,
                data.hourlyRate ?? null,
                data.durationHours ?? null,
                data.dailyRate ?? null,
                data.durationDays ?? null,
                data.calculatedFare ?? null,
                JSON.stringify(data.assignedVehicles || []),
            ]
        );
        return toDoc(rows[0]);
    },

    // findById(id)
    async findById(id) {
        const { rows } = await pool.query(
            "SELECT * FROM fleet_bookings WHERE id = $1 LIMIT 1", [id]
        );
        return toDoc(rows[0]);
    },

    /**
     * find(filter).populate(fields).sort({ createdAt: -1 })
     *
     * Supports populating:
     *   "assignedVehicles"  → joins fleet_vehicles for each id in the JSON array
     *   "assignedDriverId"  → joins captains
     *   "assignedVehicleId" → joins fleet_vehicles (single)
     */
    find(filter = {}) {
        const conditions = [];
        const values = [];
        let i = 1;

        if (filter.status !== undefined) {
            conditions.push(`fb.status = $${i++}`);
            values.push(filter.status);
        }

        const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
        const populateList = [];

        const builder = {
            populate(field, _select) {
                populateList.push(field);
                return this;
            },
            sort(_s) { return this; },
            async then(resolve, reject) {
                try {
                    // Base bookings query
                    const { rows } = await pool.query(
                        `SELECT * FROM fleet_bookings fb ${whereClause} ORDER BY created_at DESC`,
                        values
                    );

                    if (!rows.length) { resolve([]); return; }

                    // ── Populate assignedDriverId (captains) ──────────────
                    let driverMap = {};
                    if (populateList.includes("assignedDriverId")) {
                        const driverIds = [...new Set(
                            rows.map(r => r.assigned_driver_id).filter(Boolean)
                        )];
                        if (driverIds.length) {
                            const ph = driverIds.map((_, idx) => `$${idx + 1}`).join(",");
                            const { rows: dRows } = await pool.query(
                                `SELECT id, name, phone, vehicle_type, vehicle_plate,
                                        vehicle_color, vehicle_model, rating
                                 FROM captains WHERE id IN (${ph})`,
                                driverIds
                            );
                            for (const dr of dRows) {
                                driverMap[dr.id] = {
                                    _id: dr.id, id: dr.id,
                                    name: dr.name, phone: dr.phone, rating: dr.rating,
                                    vehicle: {
                                        type: dr.vehicle_type, plate: dr.vehicle_plate,
                                        color: dr.vehicle_color, model: dr.vehicle_model,
                                    }
                                };
                            }
                        }
                    }

                    // ── Populate assignedVehicleId (single fleet_vehicle) ─
                    let singleVehicleMap = {};
                    if (populateList.includes("assignedVehicleId")) {
                        const svIds = [...new Set(
                            rows.map(r => r.assigned_vehicle_id).filter(Boolean)
                        )];
                        if (svIds.length) {
                            const ph = svIds.map((_, idx) => `$${idx + 1}`).join(",");
                            const { rows: svRows } = await pool.query(
                                `SELECT id, vehicle_number, vehicle_type, driver_name, driver_phone
                                 FROM fleet_vehicles WHERE id IN (${ph})`,
                                svIds
                            );
                            for (const sv of svRows) {
                                singleVehicleMap[sv.id] = {
                                    _id: sv.id, id: sv.id,
                                    vehicleNumber: sv.vehicle_number,
                                    vehicleType: sv.vehicle_type,
                                    driverName: sv.driver_name,
                                    driverPhone: sv.driver_phone,
                                };
                            }
                        }
                    }

                    // ── Populate assignedVehicles (legacy JSONB array) ────
                    let multiVehicleMap = {};
                    if (populateList.includes("assignedVehicles")) {
                        const allIds = [...new Set(
                            rows.flatMap(r => r.assigned_vehicles || []).filter(Boolean)
                        )];
                        if (allIds.length) {
                            const ph = allIds.map((_, idx) => `$${idx + 1}`).join(",");
                            const { rows: avRows } = await pool.query(
                                `SELECT id, vehicle_number, vehicle_type, driver_name, driver_phone
                                 FROM fleet_vehicles WHERE id IN (${ph})`,
                                allIds
                            );
                            for (const av of avRows) {
                                multiVehicleMap[av.id] = {
                                    _id: av.id, id: av.id,
                                    vehicleNumber: av.vehicle_number,
                                    vehicleType: av.vehicle_type,
                                    driverName: av.driver_name,
                                    driverPhone: av.driver_phone,
                                };
                            }
                        }
                    }

                    // ── Assemble final docs ───────────────────────────────
                    const docs = rows.map(r => {
                        const doc = toDoc(r);
                        if (populateList.includes("assignedDriverId") && r.assigned_driver_id) {
                            doc.assignedDriverId = driverMap[r.assigned_driver_id] || r.assigned_driver_id;
                        }
                        if (populateList.includes("assignedVehicleId") && r.assigned_vehicle_id) {
                            doc.assignedVehicleId = singleVehicleMap[r.assigned_vehicle_id] || r.assigned_vehicle_id;
                        }
                        if (populateList.includes("assignedVehicles")) {
                            doc.assignedVehicles = (r.assigned_vehicles || [])
                                .map(id => multiVehicleMap[id] || id);
                        }
                        return doc;
                    });

                    resolve(docs);
                } catch (e) {
                    reject(e);
                }
            },
        };
        return builder;
    },

    // findByIdAndUpdate — used by updateBookingStatus
    async findByIdAndUpdate(id, update, _opts = {}) {
        const fields = [];
        const values = [];
        let i = 1;

        if (update.status !== undefined) { fields.push(`status = $${i++}`); values.push(update.status); }

        if (!fields.length) return this.findById(id);

        fields.push(`updated_at = NOW()`);
        values.push(id);

        const { rows } = await pool.query(
            `UPDATE fleet_bookings SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`,
            values
        );
        return toDoc(rows[0]);
    },

    // booking.save() — used after mutating booking.status in controller
    // Attached as instance method to each doc
};

// Wrap toDoc to inject a .save() method on booking instances
const toDocWithSave = (row) => {
    if (!row) return null;
    const doc = toDoc(row);
    doc.save = async function () {
        const { rows } = await pool.query(
            `UPDATE fleet_bookings SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
            [this.status, this._id]
        );
        Object.assign(this, toDoc(rows[0]));
        return this;
    };
    return doc;
};

// Override findById to include .save()
FleetBooking.findById = async function (id) {
    const { rows } = await pool.query(
        "SELECT * FROM fleet_bookings WHERE id = $1 LIMIT 1", [id]
    );
    return toDocWithSave(rows[0]);
};

module.exports = FleetBooking;

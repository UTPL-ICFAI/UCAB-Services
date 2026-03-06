/**
 * models/Ride.js  (PostgreSQL — raw pg)
 * Preserves the same API as the original Mongoose model.
 *
 * DB table: rides
 * pickup / dropoff stored as JSONB: { lat, lng, address }
 *
 * Key challenge: atomic "accept ride" — findOneAndUpdate with status guard
 * is replaced with a pg transaction.
 */

const pool = require("../config/db");

// ── Internal helper: map DB row → Mongoose-like shape ───────────
const toDoc = (row) => {
    if (!row) return null;
    return {
        _id: row.id,
        id: row.id,
        pickup: row.pickup,           // already parsed JSONB
        dropoff: row.dropoff,
        fare: row.fare !== null ? parseFloat(row.fare) : null,
        rideType: row.ride_type,
        captainSocketId: row.captain_socket_id,
        riderSocketId: row.rider_socket_id,
        riderId: row.rider_id,
        captainId: row.captain_id,
        otp: row.otp,
        riderRating: row.rider_rating !== null ? parseFloat(row.rider_rating) : null,
        status: row.status,
        scheduledAt: row.scheduled_at,
        paymentMethod: row.payment_method,
        cancellationFee: parseFloat(row.cancellation_fee),
        cancelledBy: row.cancelled_by,
        parcelWeight: row.parcel_weight !== null ? parseFloat(row.parcel_weight) : null,
        receiverName: row.receiver_name,
        receiverPhone: row.receiver_phone,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
};

const Ride = {
    // create({ pickup, dropoff, fare, rideType, paymentMethod, scheduledAt, status, riderSocketId, riderId, otp })
    async create(data) {
        const { rows } = await pool.query(
            `INSERT INTO rides
               (pickup, dropoff, fare, ride_type, payment_method, scheduled_at,
                status, cancellation_fee, cancelled_by, rider_socket_id, rider_id, otp,
                parcel_weight, receiver_name, receiver_phone)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
             RETURNING *`,
            [
                data.pickup ? JSON.stringify(data.pickup) : null,
                data.dropoff ? JSON.stringify(data.dropoff) : null,
                data.fare ?? null,
                data.rideType ?? "UCab Go",
                data.paymentMethod ?? "cash",
                data.scheduledAt ?? null,
                data.status ?? "requested",
                data.cancellationFee ?? 0,
                data.cancelledBy ?? null,
                data.riderSocketId ?? null,
                data.riderId ?? null,
                data.otp ?? null,
                data.parcelWeight ?? null,
                data.receiverName ?? null,
                data.receiverPhone ?? null,
            ]
        );
        return toDoc(rows[0]);
    },

    // findById(id)
    async findById(id) {
        const { rows } = await pool.query(
            "SELECT * FROM rides WHERE id = $1 LIMIT 1", [id]
        );
        return toDoc(rows[0]);
    },

    // findByIdAndUpdate(id, { status, captainId, riderRating, ... }, opts)
    async findByIdAndUpdate(id, update, _opts = {}) {
        const fields = [];
        const values = [];
        let i = 1;

        if (update.status !== undefined) { fields.push(`status = $${i++}`); values.push(update.status); }
        if (update.captainSocketId !== undefined) { fields.push(`captain_socket_id = $${i++}`); values.push(update.captainSocketId); }
        if (update.captainId !== undefined) { fields.push(`captain_id = $${i++}`); values.push(update.captainId); }
        if (update.cancelledBy !== undefined) { fields.push(`cancelled_by = $${i++}`); values.push(update.cancelledBy); }
        if (update.cancellationFee !== undefined) { fields.push(`cancellation_fee = $${i++}`); values.push(update.cancellationFee); }
        if (update.riderRating !== undefined) { fields.push(`rider_rating = $${i++}`); values.push(update.riderRating); }
        if (update.otp !== undefined) { fields.push(`otp = $${i++}`); values.push(update.otp); }
        if (update.parcelWeight !== undefined) { fields.push(`parcel_weight = $${i++}`); values.push(update.parcelWeight); }
        if (update.receiverName !== undefined) { fields.push(`receiver_name = $${i++}`); values.push(update.receiverName); }
        if (update.receiverPhone !== undefined) { fields.push(`receiver_phone = $${i++}`); values.push(update.receiverPhone); }

        if (!fields.length) return this.findById(id);

        fields.push(`updated_at = NOW()`);
        values.push(id);

        const { rows } = await pool.query(
            `UPDATE rides SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`,
            values
        );
        return toDoc(rows[0]);
    },

    /**
     * findOneAndUpdate({ _id, status: "requested" }, { status: "accepted", captainSocketId }, { new: true })
     * Atomic "accept ride" — only one captain can win the race.
     * Implemented as a Postgres transaction with a conditional UPDATE.
     */
    async findOneAndUpdate(filter, update, _opts = {}) {
        const client = await pool.connect();
        try {
            await client.query("BEGIN");

            // Build WHERE clause dynamically
            const conditions = [];
            const condValues = [];
            let ci = 1;

            if (filter._id || filter.id) {
                conditions.push(`id = $${ci++}`);
                condValues.push(filter._id || filter.id);
            }
            if (filter.status !== undefined) {
                conditions.push(`status = $${ci++}`);
                condValues.push(filter.status);
            }

            const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

            // Build SET clause
            const fields = [];
            const values = [...condValues];
            let ui = ci;

            if (update.status !== undefined) { fields.push(`status = $${ui++}`); values.push(update.status); }
            if (update.captainSocketId !== undefined) { fields.push(`captain_socket_id = $${ui++}`); values.push(update.captainSocketId); }
            if (update.captainId !== undefined) { fields.push(`captain_id = $${ui++}`); values.push(update.captainId); }
            if (update.cancelledBy !== undefined) { fields.push(`cancelled_by = $${ui++}`); values.push(update.cancelledBy); }
            if (update.otp !== undefined) { fields.push(`otp = $${ui++}`); values.push(update.otp); }

            fields.push(`updated_at = NOW()`);

            const { rows } = await client.query(
                `UPDATE rides SET ${fields.join(", ")} ${whereClause} RETURNING *`,
                values
            );

            await client.query("COMMIT");
            return rows[0] ? toDoc(rows[0]) : null;
        } catch (e) {
            await client.query("ROLLBACK");
            throw e;
        } finally {
            client.release();
        }
    },
};

module.exports = Ride;
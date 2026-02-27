/**
 * booking.service.js
 *
 * Pure-function helpers for the v2 booking flow.
 * No DB writes here — callers (controllers) own persistence.
 *
 * Exported:
 *   BOOKING_TYPES           → enum of valid booking mode strings
 *   DEFAULT_RATES           → server-side rates (never sourced from client)
 *   assignDriver(pool)      → selected Captain doc | null
 *   assignVehicle(pool)     → selected FleetVehicle doc | null
 *   calculateFare(type, opts) → Number
 */

const BOOKING_TYPES = Object.freeze({
    NORMAL: "NORMAL",
    DRIVER_ONLY: "DRIVER_ONLY",
    VEHICLE_ONLY: "VEHICLE_ONLY",
});

/**
 * Server-side rate configuration.
 * These are NEVER accepted from the client — only used internally.
 * To make configurable: move to process.env or a DB settings doc.
 */
const DEFAULT_RATES = Object.freeze({
    DRIVER_ONLY_HOURLY: 150,  // ₹ per hour
    VEHICLE_ONLY_DAILY: 1200, // ₹ per day
    NORMAL_PER_KM: 12,        // ₹ per km (used if real distance unavailable)
    NORMAL_ESTIMATED_KM: 20,  // default km estimate when geocoding is unavailable
});

/**
 * Selects the first available driver from a pre-fetched pool.
 * Returns null when the pool is empty.
 *
 * @param {Array} driverPool  - Array of Captain documents
 * @returns {Object|null}
 */
const assignDriver = (driverPool = []) => {
    if (!Array.isArray(driverPool) || driverPool.length === 0) return null;
    return driverPool[0];
};

/**
 * Selects the first available vehicle from a pre-fetched pool.
 * Returns null when the pool is empty.
 *
 * @param {Array} vehiclePool - Array of FleetVehicle documents
 * @returns {Object|null}
 */
const assignVehicle = (vehiclePool = []) => {
    if (!Array.isArray(vehiclePool) || vehiclePool.length === 0) return null;
    return vehiclePool[0];
};

/**
 * Calculates the booking fare using SERVER-SIDE rates only.
 * Clients must never supply rate values — only durations.
 *
 * NORMAL      → DEFAULT_RATES.NORMAL_PER_KM × opts.estimatedKm
 * DRIVER_ONLY → DEFAULT_RATES.DRIVER_ONLY_HOURLY × opts.durationHours
 * VEHICLE_ONLY→ DEFAULT_RATES.VEHICLE_ONLY_DAILY × opts.durationDays
 *
 * @param {string} bookingType - one of BOOKING_TYPES
 * @param {Object} opts
 * @param {number} [opts.estimatedKm]    - for NORMAL (defaults to NORMAL_ESTIMATED_KM)
 * @param {number} [opts.durationHours]  - for DRIVER_ONLY
 * @param {number} [opts.durationDays]   - for VEHICLE_ONLY
 * @returns {number}
 * @throws {Error} for unknown bookingType or invalid inputs
 */
const calculateFare = (bookingType, opts = {}) => {
    switch (bookingType) {
        case BOOKING_TYPES.NORMAL: {
            const km =
                Number(opts.estimatedKm) > 0
                    ? Number(opts.estimatedKm)
                    : DEFAULT_RATES.NORMAL_ESTIMATED_KM;
            return Math.round(DEFAULT_RATES.NORMAL_PER_KM * km);
        }
        case BOOKING_TYPES.DRIVER_ONLY: {
            const hours = Number(opts.durationHours);
            if (isNaN(hours) || hours <= 0)
                throw new Error("durationHours must be a positive number for DRIVER_ONLY bookings");
            return DEFAULT_RATES.DRIVER_ONLY_HOURLY * hours;
        }
        case BOOKING_TYPES.VEHICLE_ONLY: {
            const days = Number(opts.durationDays);
            if (isNaN(days) || days <= 0)
                throw new Error("durationDays must be a positive number for VEHICLE_ONLY bookings");
            return DEFAULT_RATES.VEHICLE_ONLY_DAILY * days;
        }
        default:
            throw new Error(
                `Invalid bookingType "${bookingType}". Must be one of: ${Object.values(BOOKING_TYPES).join(", ")}`
            );
    }
};

module.exports = { assignDriver, assignVehicle, calculateFare, BOOKING_TYPES, DEFAULT_RATES };

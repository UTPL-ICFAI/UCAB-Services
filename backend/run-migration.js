/**
 * run-migration.js
 * Adds rider_socket_id column to rides table.
 * Run once: node run-migration.js
 */
require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432"),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

(async () => {
    try {
        await pool.query(
            "ALTER TABLE rides ADD COLUMN IF NOT EXISTS rider_socket_id TEXT DEFAULT NULL"
        );
        console.log("✅ Migration done: rider_socket_id column added to rides table");
    } catch (e) {
        console.error("❌ Migration error:", e.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
})();

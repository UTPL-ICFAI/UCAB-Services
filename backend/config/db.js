/**
 * config/db.js
 * -----------
 * Single pg Pool singleton shared across the entire backend.
 *
 * Supports two .env formats:
 *
 *   Format 1 — Individual variables (recommended for local dev):
 *     DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
 *
 *   Format 2 — Single connection string (recommended for cloud):
 *     DATABASE_URL="postgresql://user:pass@host:5432/dbname?sslmode=require"
 *
 * Usage:
 *   const pool = require("../config/db");
 *   const { rows } = await pool.query("SELECT ...", [...params]);
 */

require("dotenv").config();
const { Pool } = require("pg");

// Build connection config — individual vars take priority over DATABASE_URL
const poolConfig = process.env.DB_HOST
    ? {
        host: process.env.DB_HOST || "localhost",
        port: Number(process.env.DB_PORT) || 5432,
        user: process.env.DB_USER || "postgres",
        password: process.env.DB_PASSWORD || "",
        database: process.env.DB_NAME || "ucab_db",
        ssl: false,   // local Postgres — no SSL needed
    }
    : {
        // Fall back to full connection string (cloud providers)
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL?.includes("sslmode=require")
            ? { rejectUnauthorized: false }
            : false,
    };

const pool = new Pool(poolConfig);

pool.on("connect", () => {
    console.log("✅ PostgreSQL connected");
});

pool.on("error", (err) => {
    console.error("❌ PostgreSQL pool error:", err.message);
});

module.exports = pool;

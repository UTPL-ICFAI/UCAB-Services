/**
 * config/db.js
 * 
 * Production-ready PostgreSQL Pool configuration for Render.
 * Handles SSL requirements for remote databases while supporting local development.
 */

require("dotenv").config();
const { Pool } = require("pg");

const isProduction = process.env.NODE_ENV === "production" || !!process.env.DATABASE_URL;

const poolConfig = {
    // Priority 1: Use DATABASE_URL (Standard for Render/Heroku/Supabase)
    connectionString: process.env.DATABASE_URL,

    // Priority 2: Fallback to individual variables if DATABASE_URL is missing
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "UCab",

    // SSL Configuration: Required for Render PostgreSQL
    // We enable it if in production or if DATABASE_URL is present.
    ssl: isProduction ? { rejectUnauthorized: false } : false,

    // Pool settings for performance and stability
    max: 20,              // max number of clients in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
};

const pool = new Pool(poolConfig);

// Event listeners for monitoring
pool.on("connect", () => {
    // console.log("✅ PostgreSQL Pool connected");
});

pool.on("error", (err) => {
    console.error("❌ Unexpected PostgreSQL pool error:", err.message);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    connect: () => client.connect(),
    pool // export the pool instance if needed for transactions
};

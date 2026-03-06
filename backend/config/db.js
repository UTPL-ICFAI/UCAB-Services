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
    ssl: isProduction ? { rejectUnauthorized: false } : false,

    // Pool settings — tuned for Render free tier (max ~5 connections)
    max: isProduction ? 5 : 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,  // 10s — cloud DBs have higher latency
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
    connect: () => pool.connect(),
    pool // export the pool instance if needed for transactions
};

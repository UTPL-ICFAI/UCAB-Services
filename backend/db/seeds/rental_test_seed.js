/**
 * backend/db/seeds/rental_test_seed.js
 *
 * Creates a test Rental Provider account in the DB.
 *
 * Usage:
 *   cd backend
 *   node db/seeds/rental_test_seed.js
 *
 * Test credentials:
 *   Portal  : Rental Provider Login (/login/rental)
 *   Email   : rental_test@uride.com
 *   Password: testRental@123
 */

const bcrypt = require("bcryptjs");
const pool = require("../../config/db");

async function seed() {
    const email = "rental_test@uride.com";
    const password = "testRental@123";

    // Check if already exists
    const { rows } = await pool.query(
        "SELECT id FROM fleet_owners WHERE email = $1 AND owner_type = $2",
        [email, "rental"]
    );
    if (rows.length > 0) {
        console.log("Test rental account already exists — skipping.");
        process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const placeholder = "data:text/plain;base64,VEVTVA=="; // base64("TEST")

    await pool.query(
        `INSERT INTO fleet_owners
           (owner_name, company_name, phone, email, address, total_vehicles,
            password, owner_type, insurance_cert, driver_license, owner_aadhaar, is_verified)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
            "Test Rental Owner",
            "uride Test Rentals",
            "9000000001",
            email,
            "123 Test Street, Chennai, TN 600001",
            5,
            hashedPassword,
            "rental",
            placeholder,
            placeholder,
            placeholder,
            true,
        ]
    );

    console.log("✅ Test rental account created successfully.");
    console.log("   Email   :", email);
    console.log("   Password: testRental@123");
    process.exit(0);
}

seed().catch((err) => {
    console.error("Seed failed:", err.message);
    process.exit(1);
});

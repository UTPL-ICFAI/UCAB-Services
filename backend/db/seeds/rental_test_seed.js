/**
 * backend/db/seeds/rental_test_seed.js
 *
 * Creates test Rental Provider accounts in the DB.
 *
 * Usage:
 *   cd backend
 *   node db/seeds/rental_test_seed.js
 *
 * Test credentials:
 *
 *   Account 1 — verified rental provider
 *   Portal  : Rental Provider Login (/login/rental)
 *   Email   : rental_test@uride.com
 *   Password: testRental@123
 *
 *   Account 2 — second verified provider (premium fleet)
 *   Portal  : Rental Provider Login (/login/rental)
 *   Email   : rental2@uride.com
 *   Password: Rental2@456
 *
 *   Account 3 — unverified (pending admin approval)
 *   Portal  : Rental Provider Login (/login/rental)
 *   Email   : rental_pending@uride.com
 *   Password: Pending@789
 */

const bcrypt = require("bcryptjs");
const pool = require("../../config/db");

const PLACEHOLDER = "data:text/plain;base64,VEVTVA=="; // base64("TEST")

const ACCOUNTS = [
  {
    owner_name:    "Test Rental Owner",
    company_name:  "uride Test Rentals",
    phone:         "9000000001",
    email:         "rental_test@uride.com",
    password:      "testRental@123",
    address:       "123 Test Street, Chennai, TN 600001",
    total_vehicles: 5,
    owner_type:    "rental",
    is_verified:   true,
  },
  {
    owner_name:    "Priya Sharma",
    company_name:  "Sharma Premium Rentals",
    phone:         "9000000002",
    email:         "rental2@uride.com",
    password:      "Rental2@456",
    address:       "45 MG Road, Bengaluru, KA 560001",
    total_vehicles: 12,
    owner_type:    "rental",
    is_verified:   true,
  },
  {
    owner_name:    "Ravi Kumar",
    company_name:  "Kumar Fleet Services",
    phone:         "9000000003",
    email:         "rental_pending@uride.com",
    password:      "Pending@789",
    address:       "78 Anna Salai, Chennai, TN 600002",
    total_vehicles: 3,
    owner_type:    "rental",
    is_verified:   false,
  },
];

async function seed() {
    let created = 0;
    for (const acc of ACCOUNTS) {
        const { rows } = await pool.query(
            "SELECT id FROM fleet_owners WHERE email = $1",
            [acc.email]
        );
        if (rows.length > 0) {
            console.log(`ℹ️  ${acc.email} already exists — skipping.`);
            continue;
        }

        const hashedPassword = await bcrypt.hash(acc.password, 10);

        await pool.query(
            `INSERT INTO fleet_owners
               (owner_name, company_name, phone, email, address, total_vehicles,
                password, owner_type, insurance_cert, driver_license, owner_aadhaar, is_verified)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
            [
                acc.owner_name,
                acc.company_name,
                acc.phone,
                acc.email,
                acc.address,
                acc.total_vehicles,
                hashedPassword,
                acc.owner_type,
                PLACEHOLDER,
                PLACEHOLDER,
                PLACEHOLDER,
                acc.is_verified,
            ]
        );

        console.log(`✅ Created: ${acc.email} (${acc.owner_name}) — password: ${acc.password}`);
        created++;
    }

    if (created === 0) {
        console.log("All test accounts already exist. No changes made.");
    } else {
        console.log(`\n🎉 Done — ${created} account(s) created.`);
    }
    process.exit(0);
}

seed().catch((err) => {
    console.error("Seed failed:", err.message);
    process.exit(1);
});


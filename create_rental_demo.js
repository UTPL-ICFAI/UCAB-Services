const pool = require('./backend/config/db');

async function createDemoRentalOwner() {
    try {
        const email = 'rentalowner@demo.com';
        const password = 'demo';
        
        // Check if already exists
        const existing = await pool.query(
            'SELECT id FROM fleet_owners WHERE email = $1',
            [email]
        );
        
        if (existing.rows.length > 0) {
            console.log('✅ Demo rental owner already exists');
            console.log('Email: rentalowner@demo.com');
            console.log('Password: demo');
            process.exit(0);
        }
        
        // Create demo rental owner
        const result = await pool.query(
            `INSERT INTO fleet_owners (owner_name, email, password, company_name, phone, city, wallet_balance, is_verified)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id, email, owner_name`,
            ['Demo Rental Owner', email, password, 'Demo Rentals Inc', '+91-9999999999', 'Bangalore', 0, true]
        );
        
        console.log('✅ Demo rental owner created successfully!');
        console.log('Email:', result.rows[0].email);
        console.log('Owner ID:', result.rows[0].id);
        console.log('Password: demo');
        
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

createDemoRentalOwner();

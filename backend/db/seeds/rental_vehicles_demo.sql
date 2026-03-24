-- Seed script to add dummy rental vehicles for testing
-- Run with: psql -U postgres -d ucab_services -f /path/to/this/file

-- Demo Rental Owner ID (from demo login)
-- Insert demo rental owner if not exists
INSERT INTO fleet_owners (email, password, owner_name, company_name, phone, address, owner_type, verified)
VALUES (
    'rentalowner@demo.com',
    '$2a$10$9Tl5R2.gqLYqXZZ8wTzUKuVLQkXK8F8K8VF8JfH5ZZsZ8zZ8zZ',  -- hashed 'demo123'
    'Demo Rental Provider',
    'Demo Rentals',
    '+91-98765-43210',
    'Demo City, India',
    'rental',
    TRUE
)
ON CONFLICT (email) DO NOTHING
RETURNING id;

-- Get the demo owner ID
WITH demo_owner AS (
    SELECT id FROM fleet_owners WHERE email = 'rentalowner@demo.com'
)
-- Insert 5 dummy rental vehicles
INSERT INTO fleet_vehicles (
    owner_id, vehicle_type, vehicle_number, driver_name, driver_phone, 
    seating_capacity, is_available, vehicle_color, driver_aadhaar,
    vehicle_insurance_cert, vehicle_registration, vehicle_pollution_cert,
    insurance_verified, insurance_expiry_date
)
SELECT 
    demo_owner.id,
    vehicle_types.type,
    vehicle_types.number,
    vehicle_types.driver,
    vehicle_types.phone,
    vehicle_types.seats,
    TRUE,
    vehicle_types.color,
    '123456789012',
    'https://example.com/insurance.pdf',
    'https://example.com/registration.pdf',
    'https://example.com/pollution.pdf',
    TRUE,
    (CURRENT_DATE + INTERVAL '1 year')
FROM demo_owner,
(
    VALUES 
        ('Car', 'DL01AB0001', 'Rajesh Kumar', '+91-9876543210', 5, 'White'),
        ('Car', 'DL01AB0002', 'Priya Singh', '+91-9876543211', 5, 'Silver'),
        ('Car', 'DL01AB0003', 'Amit Patel', '+91-9876543212', 5, 'Black'),
        ('SUV', 'DL01CD0001', 'Vikram Sharma', '+91-9876543213', 7, 'Grey'),
        ('Sedan', 'DL01CD0002', 'Deepak Verma', '+91-9876543214', 4, 'White')
) AS vehicle_types(type, number, driver, phone, seats, color)
ON CONFLICT (vehicle_number) DO NOTHING;

-- Verify inserted vehicles
SELECT 
    fv.id,
    fo.company_name,
    fv.vehicle_type,
    fv.vehicle_number,
    fv.driver_name,
    fv.seating_capacity,
    fv.is_available,
    fv.insurance_verified
FROM fleet_vehicles fv
JOIN fleet_owners fo ON fv.owner_id = fo.id
WHERE fo.email = 'rentalowner@demo.com'
ORDER BY fv.created_at;

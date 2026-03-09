-- =============================================================
--  006_documents_verification.sql
--  Adds document upload fields, is_verified to captains,
--  document upload fields to fleet_owners, and
--  vehicle_color + driver_aadhaar to fleet_vehicles.
-- =============================================================

-- captains: verification flag + uploaded documents
ALTER TABLE captains ADD COLUMN IF NOT EXISTS is_verified   BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE captains ADD COLUMN IF NOT EXISTS insurance_cert TEXT    DEFAULT NULL;
ALTER TABLE captains ADD COLUMN IF NOT EXISTS driver_license TEXT    DEFAULT NULL;
ALTER TABLE captains ADD COLUMN IF NOT EXISTS driver_aadhaar TEXT    DEFAULT NULL;

-- fleet_owners: uploaded documents
ALTER TABLE fleet_owners ADD COLUMN IF NOT EXISTS insurance_cert TEXT DEFAULT NULL;
ALTER TABLE fleet_owners ADD COLUMN IF NOT EXISTS driver_license TEXT DEFAULT NULL;
ALTER TABLE fleet_owners ADD COLUMN IF NOT EXISTS owner_aadhaar  TEXT DEFAULT NULL;

-- fleet_vehicles: mandatory colour + driver Aadhaar
ALTER TABLE fleet_vehicles ADD COLUMN IF NOT EXISTS vehicle_color  TEXT DEFAULT NULL;
ALTER TABLE fleet_vehicles ADD COLUMN IF NOT EXISTS driver_aadhaar TEXT DEFAULT NULL;

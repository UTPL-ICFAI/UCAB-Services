-- Migration 005: Add insurance fields and multi-location fleet support

-- Add insurance fields to rides table
ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS insurance_fee NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS has_insurance BOOLEAN DEFAULT FALSE;

-- Add multi-location support to fleet_bookings table
-- We'll use a JSONB field 'locations' to store an array of { pickup, dropoff } per vehicle
ALTER TABLE fleet_bookings
  ADD COLUMN IF NOT EXISTS locations JSONB DEFAULT '[]';

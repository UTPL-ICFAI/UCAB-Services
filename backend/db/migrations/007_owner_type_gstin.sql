-- Migration 007: Owner type isolation (fleet vs rental), GSTIN, business docs,
--                and fleet vehicle document fields

-- ── fleet_owners: add owner_type discriminator ───────────────────────────────
ALTER TABLE fleet_owners
  ADD COLUMN IF NOT EXISTS owner_type TEXT NOT NULL DEFAULT 'fleet'
  CHECK (owner_type IN ('fleet', 'rental'));

-- ── fleet_owners: add GSTIN and business document ─────────────────────────────
ALTER TABLE fleet_owners
  ADD COLUMN IF NOT EXISTS gstin TEXT DEFAULT NULL;

ALTER TABLE fleet_owners
  ADD COLUMN IF NOT EXISTS business_doc TEXT DEFAULT NULL;

-- ── fleet_vehicles: add vehicle insurance cert and driver licence ──────────────
ALTER TABLE fleet_vehicles
  ADD COLUMN IF NOT EXISTS vehicle_insurance TEXT DEFAULT NULL;

ALTER TABLE fleet_vehicles
  ADD COLUMN IF NOT EXISTS driver_license TEXT DEFAULT NULL;

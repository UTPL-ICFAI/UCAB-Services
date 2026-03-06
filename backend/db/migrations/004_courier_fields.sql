-- =============================================================
--  004_courier_fields.sql
--  Adds fields for courier/parcel details to the rides table.
-- =============================================================

ALTER TABLE rides ADD COLUMN IF NOT EXISTS parcel_weight  NUMERIC(5,2) DEFAULT NULL;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS receiver_name   TEXT         DEFAULT NULL;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS receiver_phone  TEXT         DEFAULT NULL;

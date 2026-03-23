-- Migration 012: Add 'started' column to carpool_rides for tracking ride status

ALTER TABLE carpool_rides ADD COLUMN IF NOT EXISTS started BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE carpool_rides ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_carpool_started ON carpool_rides (started);

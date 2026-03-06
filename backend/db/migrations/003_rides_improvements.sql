-- =============================================================
--  003_rides_improvements.sql
--  Run once to add user-registration fields, DB-level ride
--  associations, and rating storage.
--
--  psql "$DATABASE_URL" -f backend/db/migrations/003_rides_improvements.sql
-- =============================================================

-- ─── users: optional email + password for proper registration ─
ALTER TABLE users ADD COLUMN IF NOT EXISTS email    TEXT    DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password TEXT    DEFAULT NULL;

-- ─── rides: DB-level user/captain associations ────────────────
ALTER TABLE rides ADD COLUMN IF NOT EXISTS rider_id   UUID    DEFAULT NULL
    REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE rides ADD COLUMN IF NOT EXISTS captain_id UUID    DEFAULT NULL
    REFERENCES captains(id) ON DELETE SET NULL;

-- ─── rides: store rider's post-trip rating in DB ─────────────
ALTER TABLE rides ADD COLUMN IF NOT EXISTS rider_rating NUMERIC(3,2) DEFAULT NULL;

-- ─── rides: store otp hash on server side ─────────────────────
ALTER TABLE rides ADD COLUMN IF NOT EXISTS otp TEXT DEFAULT NULL;

-- ─── Indexes for fast captain trip-history queries ────────────
CREATE INDEX IF NOT EXISTS idx_rides_captain_id
    ON rides (captain_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rides_rider_id
    ON rides (rider_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rides_status_updated
    ON rides (status, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
    ON users (email) WHERE email IS NOT NULL;

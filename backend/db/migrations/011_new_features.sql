-- ── Migration 011: Email 2FA, Loyalty Points, Carpool, Two-way Rating, Nearby Captains ──

-- 1. Email OTP store (for rider registration 2FA)
CREATE TABLE IF NOT EXISTS email_otps (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email       TEXT        NOT NULL,
    otp_hash    TEXT        NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    used        BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_otps_email ON email_otps (email);

-- 2. Loyalty points for users
ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_points INTEGER NOT NULL DEFAULT 0;

-- 3. Average rider rating (captain rates rider)
ALTER TABLE users ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2) NOT NULL DEFAULT 5.0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS rating_count INTEGER NOT NULL DEFAULT 0;

-- 4. Captain rides with rider rating column (captain rates the rider)
ALTER TABLE rides ADD COLUMN IF NOT EXISTS captain_rating NUMERIC(2,1) DEFAULT NULL;

-- 5. Captain location columns (for nearby search)
ALTER TABLE captains ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION DEFAULT NULL;
ALTER TABLE captains ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_captains_online_location ON captains (lat, lng) WHERE is_online = TRUE;

-- 6. Carpool rides table
CREATE TABLE IF NOT EXISTS carpool_rides (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id       TEXT        NOT NULL,
    driver_name     TEXT        NOT NULL,
    driver_phone    TEXT        NOT NULL,
    vehicle_desc    TEXT        NOT NULL DEFAULT '',
    origin          JSONB       NOT NULL,    -- { lat, lng, address }
    destination     JSONB       NOT NULL,    -- { lat, lng, address }
    departure_time  TIMESTAMPTZ NOT NULL,
    total_seats     INTEGER     NOT NULL DEFAULT 3,
    available_seats INTEGER     NOT NULL DEFAULT 3,
    price_per_seat  NUMERIC     NOT NULL DEFAULT 50,
    status          TEXT        NOT NULL DEFAULT 'active', -- active | full | completed | cancelled
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_carpool_status_time ON carpool_rides (status, departure_time);

-- 7. Carpool bookings table
CREATE TABLE IF NOT EXISTS carpool_bookings (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    carpool_id      UUID        NOT NULL REFERENCES carpool_rides(id) ON DELETE CASCADE,
    rider_id        TEXT        NOT NULL,
    rider_name      TEXT        NOT NULL,
    rider_phone     TEXT        NOT NULL,
    seats           INTEGER     NOT NULL DEFAULT 1,
    status          TEXT        NOT NULL DEFAULT 'pending', -- pending | accepted | rejected | cancelled
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_carpool_bookings_pool ON carpool_bookings (carpool_id);
CREATE INDEX IF NOT EXISTS idx_carpool_bookings_rider ON carpool_bookings (rider_id);

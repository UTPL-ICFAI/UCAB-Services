-- ── P0 Feature Additions ────────────────────────────────────────────────────
-- Saved places (Home, Work, custom) per user
ALTER TABLE users ADD COLUMN IF NOT EXISTS saved_places JSONB NOT NULL DEFAULT '[]';

-- Trusted emergency contacts per user (for SOS notifications)
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contacts JSONB NOT NULL DEFAULT '[]';

-- Captain profile photo URL
ALTER TABLE captains ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Share token for public live tracking link
ALTER TABLE rides ADD COLUMN IF NOT EXISTS share_token TEXT;
CREATE INDEX IF NOT EXISTS idx_rides_share_token ON rides (share_token);

-- Surge pricing settings (single-row global config)
CREATE TABLE IF NOT EXISTS surge_settings (
    id              SERIAL      PRIMARY KEY,
    multiplier      NUMERIC(4,2) NOT NULL DEFAULT 1.0,
    auto_surge      BOOLEAN     NOT NULL DEFAULT TRUE,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO surge_settings (id, multiplier, auto_surge) VALUES (1, 1.0, TRUE)
  ON CONFLICT (id) DO NOTHING;

-- Captain arrivals log (for analytics)
CREATE TABLE IF NOT EXISTS captain_arrivals (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id     UUID        NOT NULL,
    captain_id  UUID        NOT NULL,
    arrived_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

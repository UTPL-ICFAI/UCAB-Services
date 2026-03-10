-- =============================================================
--  008_wallet_promo_bid.sql
--  Adds in-app wallet, promo codes, and bid pricing support
-- =============================================================

-- ── users: wallet balance ─────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC NOT NULL DEFAULT 0;

-- ── captains: wallet balance ──────────────────────────────────
ALTER TABLE captains
  ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC NOT NULL DEFAULT 0;

-- ── wallet_transactions: all money movements ──────────────────
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID        DEFAULT NULL REFERENCES users(id) ON DELETE CASCADE,
    captain_id    UUID        DEFAULT NULL REFERENCES captains(id) ON DELETE CASCADE,
    type          TEXT        NOT NULL CHECK (type IN ('credit','debit','promo','withdrawal_request')),
    amount        NUMERIC     NOT NULL,
    description   TEXT        NOT NULL,
    ref_ride_id   UUID        DEFAULT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_user   ON wallet_transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_captain ON wallet_transactions (captain_id, created_at DESC);

-- ── promo_codes: discount codes ───────────────────────────────
CREATE TABLE IF NOT EXISTS promo_codes (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    code          TEXT        NOT NULL UNIQUE,
    discount_type TEXT        NOT NULL DEFAULT 'percent' CHECK (discount_type IN ('percent','flat')),
    discount_value NUMERIC    NOT NULL,
    max_discount  NUMERIC     DEFAULT NULL,  -- cap for percent discounts
    min_fare      NUMERIC     NOT NULL DEFAULT 0,
    max_uses      INTEGER     DEFAULT NULL,
    used_count    INTEGER     NOT NULL DEFAULT 0,
    expires_at    TIMESTAMPTZ DEFAULT NULL,
    is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- seed some default promo codes
INSERT INTO promo_codes (code, discount_type, discount_value, max_discount, min_fare, max_uses)
VALUES
  ('UCAB20',   'percent', 20, 50,  100, NULL),
  ('FIRST50',  'flat',    50, NULL, 80, 1000),
  ('FLAT30',   'flat',    30, NULL, 60, NULL),
  ('WELCOME',  'percent', 15, 40,  50,  NULL)
ON CONFLICT (code) DO NOTHING;

-- ── rides: bid pricing fields ─────────────────────────────────
ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS bid_price  NUMERIC DEFAULT NULL;
ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS bid_status TEXT    DEFAULT NULL
  CHECK (bid_status IN ('pending','accepted','countered','rejected') OR bid_status IS NULL);
ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS bid_counter_price NUMERIC DEFAULT NULL;

-- ── sos_alerts: emergency log ─────────────────────────────────
CREATE TABLE IF NOT EXISTS sos_alerts (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id     UUID        DEFAULT NULL,
    rider_id    UUID        DEFAULT NULL,
    captain_id  UUID        DEFAULT NULL,
    location    JSONB       DEFAULT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

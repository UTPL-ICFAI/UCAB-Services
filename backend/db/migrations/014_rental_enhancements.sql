-- Migration 014: Rental Vehicle Insurance, Documents & Settlement Tracking
-- Adds insurance, vehicle documents, and settlement amount tracking for rental owners

-- ── Add columns to fleet_vehicles for insurance and documents ──────────────
ALTER TABLE fleet_vehicles ADD COLUMN IF NOT EXISTS vehicle_insurance_cert TEXT DEFAULT NULL;
ALTER TABLE fleet_vehicles ADD COLUMN IF NOT EXISTS vehicle_registration TEXT DEFAULT NULL;
ALTER TABLE fleet_vehicles ADD COLUMN IF NOT EXISTS vehicle_pollution_cert TEXT DEFAULT NULL;
ALTER TABLE fleet_vehicles ADD COLUMN IF NOT EXISTS insurance_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE fleet_vehicles ADD COLUMN IF NOT EXISTS insurance_expiry_date DATE DEFAULT NULL;

-- ── Create rental_settlement table for tracking owner payouts ─────────────
CREATE TABLE IF NOT EXISTS rental_settlement (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id            UUID        NOT NULL REFERENCES fleet_owners(id) ON DELETE CASCADE,
    booking_id          UUID        REFERENCES rental_bookings(id) ON DELETE SET NULL,
    
    -- Amount details
    booking_amount      NUMERIC(10,2) NOT NULL, -- Total rental amount
    commission_percent  NUMERIC(5,2) DEFAULT 10, -- Platform commission %
    commission_amount   NUMERIC(10,2) NOT NULL, -- Calculated commission
    settlement_amount   NUMERIC(10,2) NOT NULL, -- Amount owner gets (booking_amount - commission)
    
    -- Payment status
    status              TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed', 'rejected')),
    payment_method      TEXT DEFAULT 'uride_wallet', -- Only uride wallet for now
    
    -- Uride platform wallet movement
    uride_wallet_debit  NUMERIC(10,2) DEFAULT 0, -- Money goes to uride escrow
    uride_wallet_credit NUMERIC(10,2) DEFAULT 0, -- Money released to owner
    
    -- Timestamps
    booking_completed_at TIMESTAMPTZ,
    settlement_initiated_at TIMESTAMPTZ DEFAULT NOW(),
    settlement_completed_at TIMESTAMPTZ DEFAULT NULL,
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes for settlement queries ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_rental_settlement_owner_id ON rental_settlement(owner_id);
CREATE INDEX IF NOT EXISTS idx_rental_settlement_booking_id ON rental_settlement(booking_id);
CREATE INDEX IF NOT EXISTS idx_rental_settlement_status ON rental_settlement(status);
CREATE INDEX IF NOT EXISTS idx_rental_settlement_created_at ON rental_settlement(created_at DESC);

-- ── Create settlement_transactions for audit trail ────────────────────────
CREATE TABLE IF NOT EXISTS settlement_transactions (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_id       UUID        NOT NULL REFERENCES rental_settlement(id) ON DELETE CASCADE,
    owner_id            UUID        NOT NULL REFERENCES fleet_owners(id) ON DELETE CASCADE,
    
    -- Transaction details
    transaction_type    TEXT NOT NULL CHECK (transaction_type IN ('debit', 'credit', 'refund')),
    amount              NUMERIC(10,2) NOT NULL,
    description         TEXT,
    
    -- Uride wallet interaction
    uride_platform_fee  NUMERIC(10,2) DEFAULT 0,
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settlement_transactions_owner_id ON settlement_transactions(owner_id);
CREATE INDEX IF NOT EXISTS idx_settlement_transactions_settlement_id ON settlement_transactions(settlement_id);

-- ── Update rental_bookings to include settlement tracking ──────────────────
ALTER TABLE rental_bookings ADD COLUMN IF NOT EXISTS settlement_status TEXT DEFAULT 'pending' 
    CHECK (settlement_status IN ('pending', 'processing', 'settled', 'failed'));
ALTER TABLE rental_bookings ADD COLUMN IF NOT EXISTS settlement_id UUID DEFAULT NULL 
    REFERENCES rental_settlement(id) ON DELETE SET NULL;
ALTER TABLE rental_bookings ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'wallet' 
    CHECK (payment_method IN ('cash', 'wallet', 'upi'));
ALTER TABLE rental_bookings ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending' 
    CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded'));

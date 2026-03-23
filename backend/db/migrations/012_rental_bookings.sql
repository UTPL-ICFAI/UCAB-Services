-- Migration 012: Rental Booking System
-- Tables for rental vehicle bookings with pickup/dropoff locations

-- ── Create rental_bookings table ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rental_bookings (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    rider_id        UUID        NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    vehicle_id      UUID        NOT NULL REFERENCES fleet_vehicles(id) ON DELETE SET NULL,
    owner_id        UUID        NOT NULL REFERENCES fleet_owners(id) ON DELETE SET NULL,
    
    -- Booking status
    status          TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'accepted', 'rejected', 'active', 'completed', 'cancelled')),
    
    -- Location details
    pickup_location JSONB,      -- { lat, lng, address } - rider's location
    pickup_coords   TEXT,       -- "lat,lng" for easy indexing
    
    dropoff_location JSONB,     -- { lat, lng, address } - rider's exit point (set by rider)
    dropoff_coords   TEXT,      -- "lat,lng" for easy indexing
    
    owner_pickup_location JSONB, -- { lat, lng, address } - where owner will bring vehicle (set by owner)
    owner_pickup_coords TEXT,    -- "lat,lng" for easy indexing
    
    -- Booking details
    start_date      TIMESTAMP   NOT NULL,
    end_date        TIMESTAMP   NOT NULL,
    daily_rate      NUMERIC(10,2),
    total_price     NUMERIC(10,2),
    
    -- Insurance & extras
    insurance_selected BOOLEAN DEFAULT FALSE,
    insurance_amount   NUMERIC(10,2) DEFAULT 0,
    
    -- Timestamps
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ DEFAULT NULL
);

-- ── Indexes for fast queries ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_rental_bookings_rider_id ON rental_bookings(rider_id);
CREATE INDEX IF NOT EXISTS idx_rental_bookings_owner_id ON rental_bookings(owner_id);
CREATE INDEX IF NOT EXISTS idx_rental_bookings_vehicle_id ON rental_bookings(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_rental_bookings_status ON rental_bookings(status);
CREATE INDEX IF NOT EXISTS idx_rental_bookings_created_at ON rental_bookings(created_at DESC);

-- ── Create rental_booking_chat table (optional: for owner-rider communication) ──
CREATE TABLE IF NOT EXISTS rental_booking_chat (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id      UUID        NOT NULL REFERENCES rental_bookings(id) ON DELETE CASCADE,
    sender_id       UUID        NOT NULL,      -- rider or owner ID
    sender_type     TEXT        NOT NULL CHECK (sender_type IN ('rider', 'owner')),
    message         TEXT        NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rental_booking_chat_booking_id ON rental_booking_chat(booking_id);
CREATE INDEX IF NOT EXISTS idx_rental_booking_chat_created_at ON rental_booking_chat(created_at DESC);

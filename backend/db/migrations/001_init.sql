-- =============================================================
--  001_init.sql
--  Run once against your PostgreSQL database to create all tables.
--
--  Command:
--    psql "$DATABASE_URL" -f backend/db/migrations/001_init.sql
--  or paste into Supabase / Neon / pgAdmin SQL editor.
-- =============================================================

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================
--  users  (maps to Mongoose User.js)
-- =============================================================
CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL,
    phone       TEXT        NOT NULL UNIQUE,
    socket_id   TEXT        DEFAULT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
--  captains  (maps to Mongoose Captain.js — vehicle fields inlined)
-- =============================================================
CREATE TABLE IF NOT EXISTS captains (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT        NOT NULL,
    phone           TEXT        NOT NULL UNIQUE,
    password        TEXT        NOT NULL,
    -- embedded vehicle sub-document
    vehicle_type    TEXT        NOT NULL CHECK (vehicle_type IN ('go','premier','auto','bike')),
    vehicle_plate   TEXT        NOT NULL,
    vehicle_color   TEXT        NOT NULL,
    vehicle_model   TEXT        NOT NULL,
    -- stats
    rating          NUMERIC(3,2) NOT NULL DEFAULT 5.0,
    earnings        NUMERIC      NOT NULL DEFAULT 0,
    total_rides     INTEGER      NOT NULL DEFAULT 0,
    is_online       BOOLEAN      NOT NULL DEFAULT FALSE,
    socket_id       TEXT         DEFAULT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- =============================================================
--  rides  (maps to Mongoose Ride.js — pickup/dropoff as JSON)
-- =============================================================
CREATE TABLE IF NOT EXISTS rides (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    pickup              JSONB       DEFAULT NULL,   -- { lat, lng, address }
    dropoff             JSONB       DEFAULT NULL,   -- { lat, lng, address }
    fare                NUMERIC     DEFAULT NULL,
    ride_type           TEXT        NOT NULL DEFAULT 'UCab Go',
    captain_socket_id   TEXT        DEFAULT NULL,
    status              TEXT        NOT NULL DEFAULT 'requested',
    scheduled_at        TIMESTAMPTZ DEFAULT NULL,
    payment_method      TEXT        NOT NULL DEFAULT 'cash',
    cancellation_fee    NUMERIC     NOT NULL DEFAULT 0,
    cancelled_by        TEXT        DEFAULT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
--  fleet_owners  (maps to Mongoose fleetOwner.model.js)
-- =============================================================
CREATE TABLE IF NOT EXISTS fleet_owners (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_name      TEXT        NOT NULL,
    company_name    TEXT        NOT NULL,
    phone           TEXT        NOT NULL UNIQUE,
    email           TEXT        NOT NULL UNIQUE,
    address         TEXT        NOT NULL,
    total_vehicles  INTEGER     NOT NULL CHECK (total_vehicles >= 1),
    is_verified     BOOLEAN     NOT NULL DEFAULT FALSE,
    password        TEXT        NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
--  fleet_vehicles  (maps to Mongoose fleetVehicle.model.js)
-- =============================================================
CREATE TABLE IF NOT EXISTS fleet_vehicles (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id          UUID        NOT NULL REFERENCES fleet_owners(id) ON DELETE CASCADE,
    vehicle_type      TEXT        NOT NULL CHECK (vehicle_type IN ('Car','Bus','Van')),
    vehicle_number    TEXT        NOT NULL UNIQUE,
    driver_name       TEXT        NOT NULL,
    driver_phone      TEXT        NOT NULL,
    seating_capacity  INTEGER     NOT NULL CHECK (seating_capacity >= 1),
    is_available      BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fleet_vehicles_owner_avail
    ON fleet_vehicles (owner_id, is_available);

-- =============================================================
--  fleet_bookings  (maps to Mongoose fleetBooking.model.js)
-- =============================================================
CREATE TABLE IF NOT EXISTS fleet_bookings (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    client_name             TEXT        NOT NULL,
    client_phone            TEXT        NOT NULL,
    client_email            TEXT        NOT NULL,
    client_type             TEXT        NOT NULL CHECK (client_type IN ('Company','School','Other')),
    vehicle_type            TEXT        NOT NULL CHECK (vehicle_type IN ('Car','Bus','Van')),
    num_vehicles            INTEGER     NOT NULL CHECK (num_vehicles >= 1),
    pickup_location         TEXT        NOT NULL,
    drop_location           TEXT        NOT NULL,
    date                    TIMESTAMPTZ NOT NULL,
    status                  TEXT        NOT NULL DEFAULT 'pending'
                                        CHECK (status IN ('pending','confirmed','cancelled')),
    -- v2 fields
    booking_type            TEXT        NOT NULL DEFAULT 'NORMAL'
                                        CHECK (booking_type IN ('NORMAL','DRIVER_ONLY','VEHICLE_ONLY')),
    assigned_driver_id      UUID        DEFAULT NULL REFERENCES captains(id) ON DELETE SET NULL,
    assigned_vehicle_id     UUID        DEFAULT NULL REFERENCES fleet_vehicles(id) ON DELETE SET NULL,
    customer_vehicle_details JSONB      DEFAULT NULL, -- { make, model, plate, year }
    hourly_rate             NUMERIC     DEFAULT NULL,
    duration_hours          NUMERIC     DEFAULT NULL,
    daily_rate              NUMERIC     DEFAULT NULL,
    duration_days           NUMERIC     DEFAULT NULL,
    calculated_fare         NUMERIC     DEFAULT NULL,
    -- legacy v1 array stored as JSONB array of UUIDs
    assigned_vehicles       JSONB       NOT NULL DEFAULT '[]',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fleet_bookings_status_date
    ON fleet_bookings (status, date DESC);

-- =============================================================
--  notifications  (maps to Mongoose notification.model.js)
-- =============================================================
CREATE TABLE IF NOT EXISTS notifications (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id   TEXT        NOT NULL,
    receiver_id TEXT        NOT NULL,
    type        TEXT        NOT NULL CHECK (type IN ('RIDE_BOOKED','RIDE_ACCEPTED')),
    ride_id     UUID        DEFAULT NULL,   -- soft ref to rides.id (no FK — loose typing)
    message     TEXT        NOT NULL,
    is_read     BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_receiver_read
    ON notifications (receiver_id, is_read, created_at DESC);

-- Migration 013: Support Team System
-- Table for support team members and their access

CREATE TABLE IF NOT EXISTS support_team (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    username        TEXT        NOT NULL UNIQUE,
    password_hash   TEXT        NOT NULL,
    name            TEXT        NOT NULL,
    email           TEXT,
    role            TEXT        NOT NULL DEFAULT 'support'
                    CHECK (role IN ('support', 'supervisor', 'admin')),
    status          TEXT        NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'inactive')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_team_username ON support_team(username);
CREATE INDEX IF NOT EXISTS idx_support_team_role ON support_team(role);

-- 009_support_tickets.sql
-- Rider support / complaint ticket system

CREATE TABLE IF NOT EXISTS support_tickets (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL,
    ride_id     UUID,
    category    TEXT        NOT NULL DEFAULT 'general',
    subject     TEXT        NOT NULL,
    description TEXT,
    status      TEXT        NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','in_review','resolved','closed')),
    admin_note  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets (user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status  ON support_tickets (status);

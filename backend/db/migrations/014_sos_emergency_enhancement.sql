-- 014_sos_emergency_enhancement.sql
-- Add emergency contacts and enhanced SOS tracking

ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contacts JSONB DEFAULT '[]';
-- Format: [{ "name": "Mom", "phone": "+919876543210", "relation": "Mother" }, ...]

ALTER TABLE sos_alerts ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
-- status: active, cancelled, resolved

ALTER TABLE sos_alerts ALTER COLUMN location TYPE JSONB USING location::JSONB;
-- Store location as: { lat, lng, address }

CREATE TABLE IF NOT EXISTS sos_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sos_alert_id UUID REFERENCES sos_alerts(id) ON DELETE CASCADE,
    contact_phone VARCHAR(20),
    contact_name VARCHAR(100),
    message_text TEXT,
    sent_at TIMESTAMP DEFAULT NOW(),
    delivery_status VARCHAR(20) DEFAULT 'pending', -- pending, sent, failed
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_sos_notifications_alert ON sos_notifications(sos_alert_id);
CREATE INDEX IF NOT EXISTS idx_sos_notifications_status ON sos_notifications(delivery_status);

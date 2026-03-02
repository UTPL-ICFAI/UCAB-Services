-- =============================================================
--  002_add_rider_socket_id.sql
--  Adds rider_socket_id to the rides table so the server can
--  send "ride accepted" directly to the requesting rider's socket.
--
--  Run once:
--    psql "$DATABASE_URL" -f backend/db/migrations/002_add_rider_socket_id.sql
--  or paste into Supabase / Neon / pgAdmin SQL editor.
-- =============================================================

ALTER TABLE rides
    ADD COLUMN IF NOT EXISTS rider_socket_id TEXT DEFAULT NULL;

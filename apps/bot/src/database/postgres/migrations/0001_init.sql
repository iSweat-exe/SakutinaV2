CREATE TABLE IF NOT EXISTS activity_daily (
  guild_id text NOT NULL,
  member_id text NOT NULL,
  day date NOT NULL,
  messages integer NOT NULL DEFAULT 0,
  voice_seconds integer NOT NULL DEFAULT 0,
  joins integer NOT NULL DEFAULT 0,
  attributed_invites integer NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, member_id, day)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS audit_event (
  id uuid PRIMARY KEY,
  action text NOT NULL,
  guild_id text NOT NULL,
  occurred_at timestamptz NOT NULL,
  actor_id text,
  target_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS audit_event_guild_time_idx ON audit_event (guild_id, occurred_at);
--> statement-breakpoint
-- Supabase expose le schéma public via PostgREST : sans politique, la clé anon ne lit rien.
-- Le bot se connecte avec le rôle propriétaire, qui contourne RLS.
ALTER TABLE activity_daily ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE audit_event ENABLE ROW LEVEL SECURITY;

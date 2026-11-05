-- Avertissements de modération. Conservés un an : contrairement à l'activité, ils servent de mémoire aux modérateurs.
CREATE TABLE IF NOT EXISTS moderation_warning (
  id serial PRIMARY KEY,
  guild_id text NOT NULL,
  member_id text NOT NULL,
  moderator_id text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS moderation_warning_member_idx ON moderation_warning (guild_id, member_id, created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS moderation_warning_time_idx ON moderation_warning (created_at);
--> statement-breakpoint
ALTER TABLE moderation_warning ENABLE ROW LEVEL SECURITY;

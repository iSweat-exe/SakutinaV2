ALTER TABLE activity_daily ADD COLUMN IF NOT EXISTS characters integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE activity_daily ADD COLUMN IF NOT EXISTS replies integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE activity_daily ADD COLUMN IF NOT EXISTS attachments integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE activity_daily ADD COLUMN IF NOT EXISTS mentions integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE activity_daily ADD COLUMN IF NOT EXISTS reactions_given integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE activity_daily ADD COLUMN IF NOT EXISTS reactions_received integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE activity_daily ADD COLUMN IF NOT EXISTS leaves integer NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS activity_daily_guild_day_idx ON activity_daily (guild_id, day);
--> statement-breakpoint
-- Messages et vocal d'un membre par salon : « salons les plus actifs ».
CREATE TABLE IF NOT EXISTS activity_channel_daily (
  guild_id text NOT NULL,
  member_id text NOT NULL,
  channel_id text NOT NULL,
  day date NOT NULL,
  messages integer NOT NULL DEFAULT 0,
  voice_seconds integer NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, member_id, channel_id, day)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS activity_channel_daily_guild_day_idx ON activity_channel_daily (guild_id, day);
--> statement-breakpoint
-- Messages du serveur par heure UTC : agrégat anonyme, sans identifiant de membre.
CREATE TABLE IF NOT EXISTS activity_hourly (
  guild_id text NOT NULL,
  day date NOT NULL,
  hour smallint NOT NULL,
  messages integer NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, day, hour),
  CONSTRAINT activity_hourly_hour_range CHECK (hour >= 0 AND hour <= 23)
);
--> statement-breakpoint
-- Fiche minimale : dates d'arrivée, de départ et de dernière activité, sans aucun contenu.
CREATE TABLE IF NOT EXISTS member_profile (
  guild_id text NOT NULL,
  member_id text NOT NULL,
  first_seen_at timestamptz NOT NULL,
  joined_at timestamptz,
  left_at timestamptz,
  last_active_at timestamptz,
  PRIMARY KEY (guild_id, member_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS member_profile_last_active_idx ON member_profile (guild_id, last_active_at);
--> statement-breakpoint
ALTER TABLE activity_channel_daily ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE activity_hourly ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE member_profile ENABLE ROW LEVEL SECURITY;

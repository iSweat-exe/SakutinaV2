-- Phaéthon : relations, rythme, présence, jeux et identité. Uniquement des métadonnées :
-- jamais le contenu d'un message. Détail conservé 30 jours ; résumé mensuel durable.

-- Interactions dirigées entre deux membres (réponses, mentions, réactions, vocal commun).
CREATE TABLE IF NOT EXISTS social_edge_daily (
  guild_id text NOT NULL,
  member_id text NOT NULL,
  target_id text NOT NULL,
  day date NOT NULL,
  replies integer NOT NULL DEFAULT 0,
  mentions integer NOT NULL DEFAULT 0,
  reactions integer NOT NULL DEFAULT 0,
  voice_seconds integer NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, member_id, target_id, day)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS social_edge_daily_target_idx ON social_edge_daily (guild_id, target_id, day);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS social_edge_daily_day_idx ON social_edge_daily (day);
--> statement-breakpoint
-- Messages d'un membre par heure UTC (rythme de vie).
CREATE TABLE IF NOT EXISTS member_hour_daily (
  guild_id text NOT NULL,
  member_id text NOT NULL,
  day date NOT NULL,
  hour smallint NOT NULL,
  messages integer NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, member_id, day, hour),
  CONSTRAINT member_hour_daily_hour_range CHECK (hour >= 0 AND hour <= 23)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS member_hour_daily_day_idx ON member_hour_daily (day);
--> statement-breakpoint
-- Temps passé en ligne, absent ou ne pas déranger.
CREATE TABLE IF NOT EXISTS presence_status_daily (
  guild_id text NOT NULL,
  member_id text NOT NULL,
  day date NOT NULL,
  status text NOT NULL,
  seconds integer NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, member_id, day, status)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS presence_status_daily_day_idx ON presence_status_daily (day);
--> statement-breakpoint
-- Temps passé sur chaque activité Discord (jeu, musique, stream…).
CREATE TABLE IF NOT EXISTS presence_game_daily (
  guild_id text NOT NULL,
  member_id text NOT NULL,
  day date NOT NULL,
  kind text NOT NULL,
  name text NOT NULL,
  seconds integer NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, member_id, day, kind, name)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS presence_game_daily_day_idx ON presence_game_daily (day);
--> statement-breakpoint
-- Changements de nom, de pseudo, d'avatar, de rôles, de boost et de timeout.
CREATE TABLE IF NOT EXISTS identity_event (
  id uuid PRIMARY KEY,
  guild_id text NOT NULL,
  member_id text NOT NULL,
  kind text NOT NULL,
  old_value text,
  new_value text,
  occurred_at timestamptz NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS identity_event_member_idx ON identity_event (guild_id, member_id, occurred_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS identity_event_time_idx ON identity_event (occurred_at);
--> statement-breakpoint
-- Alertes déjà émises : une clé n'est émise qu'une fois.
CREATE TABLE IF NOT EXISTS phaethon_alert (
  guild_id text NOT NULL,
  key text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (guild_id, key)
);
--> statement-breakpoint
-- Résumé durable : le détail quotidien purgé à 30 jours est agrégé par mois.
CREATE TABLE IF NOT EXISTS activity_monthly (
  guild_id text NOT NULL,
  member_id text NOT NULL,
  month text NOT NULL,
  active_days integer NOT NULL DEFAULT 0,
  messages integer NOT NULL DEFAULT 0,
  characters integer NOT NULL DEFAULT 0,
  replies integer NOT NULL DEFAULT 0,
  attachments integer NOT NULL DEFAULT 0,
  mentions integer NOT NULL DEFAULT 0,
  reactions_given integer NOT NULL DEFAULT 0,
  reactions_received integer NOT NULL DEFAULT 0,
  voice_seconds integer NOT NULL DEFAULT 0,
  joins integer NOT NULL DEFAULT 0,
  leaves integer NOT NULL DEFAULT 0,
  attributed_invites integer NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, member_id, month)
);
--> statement-breakpoint
ALTER TABLE social_edge_daily ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE member_hour_daily ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE presence_status_daily ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE presence_game_daily ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE identity_event ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE phaethon_alert ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE activity_monthly ENABLE ROW LEVEL SECURITY;

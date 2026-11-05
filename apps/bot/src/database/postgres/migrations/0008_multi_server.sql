-- Multi-serveur : le bot sert tous les serveurs qui l'invitent.
--
-- `bot_guild`     : serveurs où le bot est présent. Tenue par le bot (arrivée, mise à jour, départ) ;
--                   le panneau y lit le nom, l'icône et la bannière.
-- `guild_manager` : membres qui peuvent gérer un serveur (Administrateur ou « Gérer le serveur » par
--                   leurs rôles). Recalculée par le bot quand les rôles changent ; le propriétaire est
--                   `bot_guild.owner_id`. C'est la source de l'accès au panneau, avec `panel_admin`.
-- `guild_settings`: réglages propres à chaque serveur, lus par le bot (rôles du bot, salon d'alertes).
--                   Remplace ADMIN_ROLE_IDS / MODERATOR_ROLE_IDS / ALERT_CHANNEL_ID.

CREATE TABLE IF NOT EXISTS bot_guild (
  guild_id text PRIMARY KEY,
  name text NOT NULL,
  icon text,
  banner text,
  owner_id text NOT NULL,
  member_count integer NOT NULL DEFAULT 0,
  joined_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE bot_guild ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS guild_manager (
  guild_id text NOT NULL,
  member_id text NOT NULL,
  PRIMARY KEY (guild_id, member_id)
);
--> statement-breakpoint
ALTER TABLE guild_manager ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS guild_settings (
  guild_id text PRIMARY KEY,
  admin_role_ids text[] NOT NULL DEFAULT '{}',
  moderator_role_ids text[] NOT NULL DEFAULT '{}',
  alert_channel_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE guild_settings ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Rôle de l'appelant sur un serveur, ou NULL :
--   1. une entrée `panel_admin` (ajout manuel) l'emporte ;
--   2. sinon, si le bot est sur le serveur : propriétaire → 'owner', gestionnaire → 'admin'.
-- L'identité vient toujours de `auth.identities` (fournisseur Discord), jamais de `user_metadata`.
CREATE OR REPLACE FUNCTION panel_role(p_guild_id text) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_discord_id text;
  v_role text;
BEGIN
  SELECT i.provider_id INTO v_discord_id
  FROM auth.identities i
  WHERE i.provider = 'discord' AND i.user_id = auth.uid()
  LIMIT 1;

  IF v_discord_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT a.role INTO v_role
  FROM panel_admin a
  WHERE a.guild_id = p_guild_id AND a.discord_id = v_discord_id;

  IF v_role IS NOT NULL THEN
    RETURN v_role;
  END IF;

  IF EXISTS (SELECT 1 FROM bot_guild g WHERE g.guild_id = p_guild_id AND g.owner_id = v_discord_id) THEN
    RETURN 'owner';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM guild_manager m
    JOIN bot_guild g ON g.guild_id = m.guild_id
    WHERE m.guild_id = p_guild_id AND m.member_id = v_discord_id
  ) THEN
    RETURN 'admin';
  END IF;

  RETURN NULL;
END;
$$;

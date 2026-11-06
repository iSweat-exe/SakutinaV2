-- Anti-raid. Le bot repère une rafale d'arrivées (fenêtre glissante, les comptes Discord récents comptent double),
-- déclare un raid et répond selon les réglages du serveur : observation seule, quarantaine (timeout de 24 h), expulsion
-- ou bannissement des comptes arrivés pendant le raid ; en option, verrouillage des salons (@everyone ne peut plus
-- écrire), alerte dans le salon d'alertes et vérification du serveur au plus haut niveau. Un administrateur peut aussi
-- verrouiller ou lever le raid lui-même (`/server lockdown`, `/server unlock`, ou le panneau).
--
-- `raid_event`           : un raid et son bilan (compteurs, administrateurs). Aucun identifiant de membre visé : chaque
--                          action est dans `audit_event`. Un seul raid ouvert par serveur. Conservé un an.
-- `raid_lockdown_channel`: la permission de @everyone de chaque salon verrouillé, enregistrée AVANT d'y toucher, pour la
--                          rétablir exactement à la fin, même après un redémarrage. Supprimée salon par salon une fois
--                          rétablie.
-- `raid_command`         : demandes du panneau (« verrouiller maintenant », « lever le raid »), exécutées par le bot. Le
--                          panneau n'a aucun accès à Discord. Traitées : gardées 30 jours.

ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS antiraid_enabled boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS antiraid_join_threshold integer NOT NULL DEFAULT 10;
--> statement-breakpoint
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS antiraid_window_seconds integer NOT NULL DEFAULT 30;
--> statement-breakpoint
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS antiraid_min_account_age_days integer NOT NULL DEFAULT 7;
--> statement-breakpoint
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS antiraid_action text NOT NULL DEFAULT 'quarantine';
--> statement-breakpoint
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS antiraid_lock_channels boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS antiraid_alert boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS antiraid_raise_verification boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE guild_settings ADD CONSTRAINT guild_settings_antiraid_ranges CHECK (
  antiraid_join_threshold BETWEEN 3 AND 50
  AND antiraid_window_seconds BETWEEN 5 AND 120
  AND antiraid_min_account_age_days BETWEEN 0 AND 30
  AND antiraid_action IN ('watch', 'quarantine', 'kick', 'ban')
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS raid_event (
  id uuid PRIMARY KEY,
  guild_id text NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  trigger text NOT NULL,
  started_by text,
  ended_by text,
  joins integer NOT NULL DEFAULT 0,
  window_seconds integer NOT NULL,
  action text NOT NULL,
  actioned integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  locked_channels integer NOT NULL DEFAULT 0,
  verification_before smallint,
  CONSTRAINT raid_event_trigger CHECK (trigger IN ('burst', 'manual')),
  CONSTRAINT raid_event_action CHECK (action IN ('watch', 'quarantine', 'kick', 'ban'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS raid_event_open_idx ON raid_event (guild_id) WHERE ended_at IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS raid_event_guild_idx ON raid_event (guild_id, started_at);
--> statement-breakpoint
ALTER TABLE raid_event ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS raid_lockdown_channel (
  raid_id uuid NOT NULL REFERENCES raid_event (id) ON DELETE CASCADE,
  guild_id text NOT NULL,
  channel_id text NOT NULL,
  had_overwrite boolean NOT NULL,
  allow text NOT NULL DEFAULT '0',
  deny text NOT NULL DEFAULT '0',
  PRIMARY KEY (raid_id, channel_id)
);
--> statement-breakpoint
ALTER TABLE raid_lockdown_channel ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS raid_command (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL,
  action text NOT NULL,
  requested_by text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  processed_at timestamptz,
  error text,
  CONSTRAINT raid_command_action CHECK (action IN ('start', 'end')),
  CONSTRAINT raid_command_status CHECK (status IN ('pending', 'done', 'failed'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS raid_command_pending_idx ON raid_command (requested_at) WHERE status = 'pending';
--> statement-breakpoint
ALTER TABLE raid_command ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Ce que la page Anti-Raid affiche : réglages, raid en cours, arrivées des 10 dernières minutes (minute par minute),
-- demande en attente ou en échec, et les 20 derniers raids.
CREATE OR REPLACE FUNCTION panel_antiraid(p_guild_id text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_now timestamptz := now();
  v_settings jsonb;
  v_active jsonb;
  v_minutes jsonb;
  v_joins integer;
  v_young integer;
BEGIN
  PERFORM panel_assert_admin(p_guild_id);

  SELECT jsonb_build_object(
    'enabled', coalesce(s.antiraid_enabled, false),
    'join_threshold', coalesce(s.antiraid_join_threshold, 10),
    'window_seconds', coalesce(s.antiraid_window_seconds, 30),
    'min_account_age_days', coalesce(s.antiraid_min_account_age_days, 7),
    'action', coalesce(s.antiraid_action, 'quarantine'),
    'lock_channels', coalesce(s.antiraid_lock_channels, true),
    'alert_admins', coalesce(s.antiraid_alert, true),
    'raise_verification', coalesce(s.antiraid_raise_verification, false),
    'alert_channel', s.alert_channel_id IS NOT NULL
  )
  INTO v_settings
  FROM (SELECT 1) one
  LEFT JOIN guild_settings s ON s.guild_id = p_guild_id;

  SELECT jsonb_build_object(
    'id', r.id,
    'started_at', r.started_at,
    'trigger', r.trigger,
    'started_by', r.started_by,
    'started_by_name', (SELECT p.display_name FROM member_profile p WHERE p.guild_id = p_guild_id AND p.member_id = r.started_by),
    'joins', r.joins,
    'action', r.action,
    'actioned', r.actioned,
    'failed', r.failed,
    'locked_channels', r.locked_channels,
    'verification_raised', r.verification_before IS NOT NULL
  )
  INTO v_active
  FROM raid_event r
  WHERE r.guild_id = p_guild_id AND r.ended_at IS NULL;

  -- Arrivées par minute, de la plus ancienne à la minute en cours ; un compte plus jeune que le réglage compte à part.
  WITH joins AS (
    SELECT a.occurred_at,
      CASE WHEN a.target_id ~ '^[0-9]{5,25}$'
        THEN to_timestamp((div(a.target_id::numeric, 4194304) + 1420070400000) / 1000.0)
      END AS created_at
    FROM audit_event a
    WHERE a.guild_id = p_guild_id AND a.action = 'member.joined' AND a.occurred_at > v_now - interval '10 minutes'
  )
  SELECT
    (SELECT jsonb_agg(
      (SELECT count(*) FROM joins j WHERE j.occurred_at > v_now - make_interval(mins => m + 1) AND j.occurred_at <= v_now - make_interval(mins => m))
      ORDER BY m DESC
    ) FROM generate_series(0, 9) AS m),
    (SELECT count(*) FROM joins),
    (SELECT count(*) FROM joins j
      WHERE j.created_at IS NOT NULL
        AND j.created_at > j.occurred_at - make_interval(days => (v_settings ->> 'min_account_age_days')::integer))
  INTO v_minutes, v_joins, v_young;

  RETURN jsonb_build_object(
    'generated_at', v_now,
    'settings', v_settings,
    'active', v_active,
    'joins_10m', v_joins,
    'young_joins_10m', v_young,
    'joins_per_minute', v_minutes,
    'raids_30d', (SELECT count(*) FROM raid_event r WHERE r.guild_id = p_guild_id AND r.started_at > v_now - interval '30 days'),
    'pending', (
      SELECT jsonb_build_object('action', c.action, 'requested_at', c.requested_at)
      FROM raid_command c
      WHERE c.guild_id = p_guild_id AND c.status = 'pending'
      ORDER BY c.requested_at
      LIMIT 1
    ),
    'last_failure', (
      SELECT jsonb_build_object('action', c.action, 'error', c.error, 'at', c.processed_at)
      FROM raid_command c
      WHERE c.guild_id = p_guild_id AND c.status = 'failed' AND c.processed_at > v_now - interval '1 hour'
      ORDER BY c.processed_at DESC
      LIMIT 1
    ),
    'history', coalesce((
      SELECT jsonb_agg(h.item ORDER BY h.started_at DESC)
      FROM (
        SELECT r.started_at, jsonb_build_object(
          'id', r.id,
          'started_at', r.started_at,
          'ended_at', r.ended_at,
          'trigger', r.trigger,
          'joins', r.joins,
          'window_seconds', r.window_seconds,
          'action', r.action,
          'actioned', r.actioned,
          'failed', r.failed,
          'locked_channels', r.locked_channels,
          'verification_raised', r.verification_before IS NOT NULL,
          'started_by_name', (SELECT p.display_name FROM member_profile p WHERE p.guild_id = p_guild_id AND p.member_id = r.started_by),
          'ended_by', r.ended_by,
          'ended_by_name', (SELECT p.display_name FROM member_profile p WHERE p.guild_id = p_guild_id AND p.member_id = r.ended_by)
        ) AS item
        FROM raid_event r
        WHERE r.guild_id = p_guild_id AND r.ended_at IS NOT NULL
        ORDER BY r.started_at DESC
        LIMIT 20
      ) h
    ), '[]'::jsonb)
  );
END;
$$;
--> statement-breakpoint
-- Change les réglages de l'anti-raid (seuls les arguments donnés changent). Valeurs bornées ici et par la contrainte
-- de la table ; journalisé avec son auteur. Le bot les applique dans les 10 secondes (cache des réglages).
CREATE OR REPLACE FUNCTION panel_set_antiraid(
  p_guild_id text,
  p_enabled boolean DEFAULT NULL,
  p_join_threshold integer DEFAULT NULL,
  p_window_seconds integer DEFAULT NULL,
  p_min_account_age_days integer DEFAULT NULL,
  p_action text DEFAULT NULL,
  p_lock_channels boolean DEFAULT NULL,
  p_alert_admins boolean DEFAULT NULL,
  p_raise_verification boolean DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM panel_assert_admin(p_guild_id);

  IF (p_join_threshold IS NOT NULL AND p_join_threshold NOT BETWEEN 3 AND 50)
     OR (p_window_seconds IS NOT NULL AND p_window_seconds NOT BETWEEN 5 AND 120)
     OR (p_min_account_age_days IS NOT NULL AND p_min_account_age_days NOT BETWEEN 0 AND 30)
     OR (p_action IS NOT NULL AND p_action NOT IN ('watch', 'quarantine', 'kick', 'ban')) THEN
    RAISE EXCEPTION 'invalid anti-raid settings' USING ERRCODE = '22023';
  END IF;

  IF coalesce(p_enabled, p_lock_channels, p_alert_admins, p_raise_verification) IS NOT NULL
     OR coalesce(p_join_threshold, p_window_seconds, p_min_account_age_days) IS NOT NULL
     OR p_action IS NOT NULL THEN
    INSERT INTO guild_settings (guild_id) VALUES (p_guild_id) ON CONFLICT (guild_id) DO NOTHING;

    UPDATE guild_settings SET
      antiraid_enabled = coalesce(p_enabled, antiraid_enabled),
      antiraid_join_threshold = coalesce(p_join_threshold, antiraid_join_threshold),
      antiraid_window_seconds = coalesce(p_window_seconds, antiraid_window_seconds),
      antiraid_min_account_age_days = coalesce(p_min_account_age_days, antiraid_min_account_age_days),
      antiraid_action = coalesce(p_action, antiraid_action),
      antiraid_lock_channels = coalesce(p_lock_channels, antiraid_lock_channels),
      antiraid_alert = coalesce(p_alert_admins, antiraid_alert),
      antiraid_raise_verification = coalesce(p_raise_verification, antiraid_raise_verification),
      updated_at = now()
    WHERE guild_id = p_guild_id;

    INSERT INTO audit_event (id, action, guild_id, occurred_at, actor_id, target_id, metadata)
    VALUES (
      gen_random_uuid(),
      'settings.antiraid',
      p_guild_id,
      now(),
      panel_caller_discord_id(),
      NULL,
      jsonb_strip_nulls(jsonb_build_object(
        'enabled', p_enabled,
        'join_threshold', p_join_threshold,
        'window_seconds', p_window_seconds,
        'min_account_age_days', p_min_account_age_days,
        'action', p_action,
        'lock_channels', p_lock_channels,
        'alert_admins', p_alert_admins,
        'raise_verification', p_raise_verification,
        'source', 'panel'
      ))
    );
  END IF;

  RETURN panel_antiraid(p_guild_id);
END;
$$;
--> statement-breakpoint
-- Demande au bot de verrouiller le serveur (« start ») ou de lever le raid en cours (« end »). Refusée (22023) quand
-- elle n'a pas de sens : verrouiller pendant un raid, lever sans raid. Une demande identique en attente n'est pas doublée.
CREATE OR REPLACE FUNCTION panel_request_raid(p_guild_id text, p_action text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_caller text;
  v_open boolean;
BEGIN
  PERFORM panel_assert_admin(p_guild_id);

  v_caller := panel_caller_discord_id();
  v_open := EXISTS (SELECT 1 FROM raid_event WHERE guild_id = p_guild_id AND ended_at IS NULL);

  IF p_action IS NULL OR p_action NOT IN ('start', 'end') OR (p_action = 'start' AND v_open) OR (p_action = 'end' AND NOT v_open) THEN
    RAISE EXCEPTION 'invalid raid request' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM raid_command WHERE guild_id = p_guild_id AND action = p_action AND status = 'pending') THEN
    INSERT INTO raid_command (guild_id, action, requested_by) VALUES (p_guild_id, p_action, coalesce(v_caller, 'unknown'));

    INSERT INTO audit_event (id, action, guild_id, occurred_at, actor_id, target_id, metadata)
    VALUES (gen_random_uuid(), 'antiraid.requested', p_guild_id, now(), v_caller, NULL,
            jsonb_build_object('request', p_action, 'source', 'panel'));
  END IF;

  RETURN jsonb_build_object('status', 'pending');
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION panel_antiraid(text) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION panel_set_antiraid(text, boolean, integer, integer, integer, text, boolean, boolean, boolean) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION panel_request_raid(text, text) FROM PUBLIC;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION panel_antiraid(text) FROM anon;
    REVOKE ALL ON FUNCTION panel_set_antiraid(text, boolean, integer, integer, integer, text, boolean, boolean, boolean) FROM anon;
    REVOKE ALL ON FUNCTION panel_request_raid(text, text) FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION panel_antiraid(text) TO authenticated;
    GRANT EXECUTE ON FUNCTION panel_set_antiraid(text, boolean, integer, integer, integer, text, boolean, boolean, boolean) TO authenticated;
    GRANT EXECUTE ON FUNCTION panel_request_raid(text, text) TO authenticated;
  END IF;
END;
$$;

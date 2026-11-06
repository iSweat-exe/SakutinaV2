-- Modules et salon d'alertes.
--
-- 1. Interrupteurs de module par serveur (tableau de bord et page Modules du panneau) :
--    `casino_enabled`    : interrupteur général du casino, au-dessus des réglages par jeu (chaque jeu garde son état et
--                          sa mise maximale : le rouvrir rend les jeux tels qu'ils étaient) ;
--    `phaethon_enabled`  : coupé, Phaéthon ne publie plus d'alertes et sa page affiche « module off ». La collecte des
--                          métadonnées continue (elle sert aussi à /phaethon et aux statistiques) ;
--    `profiling_enabled` : coupé, la page Profiling est masquée et `panel_profiling` refuse (SQLSTATE 55000).
--    L'anti-raid garde son interrupteur (`antiraid_enabled`, migration 0021).
-- 2. `guild_channel` : les salons où le bot peut écrire, tenus par le bot, pour choisir le salon d'alertes dans le
--    panneau (qui n'a aucun accès à Discord). Aucune donnée de membre.
-- 3. Profiling : messages et vocal depuis l'arrivée (résumés mensuels + détail gardé), en plus des 30 derniers jours.

ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS casino_enabled boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS phaethon_enabled boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS profiling_enabled boolean NOT NULL DEFAULT true;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS guild_channel (
  guild_id text NOT NULL,
  channel_id text NOT NULL,
  name text NOT NULL,
  category text,
  position integer NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, channel_id)
);
--> statement-breakpoint
ALTER TABLE guild_channel ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- État des modules d'un serveur, et s'il est en raid (carte Security du tableau de bord).
CREATE OR REPLACE FUNCTION panel_modules(p_guild_id text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM panel_assert_admin(p_guild_id);

  RETURN (
    SELECT jsonb_build_object(
      'antiraid', coalesce(s.antiraid_enabled, false),
      'casino', coalesce(s.casino_enabled, true),
      'phaethon', coalesce(s.phaethon_enabled, true),
      'profiling', coalesce(s.profiling_enabled, true),
      'raid_active', EXISTS (SELECT 1 FROM raid_event r WHERE r.guild_id = p_guild_id AND r.ended_at IS NULL)
    )
    FROM (SELECT 1) one
    LEFT JOIN guild_settings s ON s.guild_id = p_guild_id
  );
END;
$$;
--> statement-breakpoint
-- Active ou coupe un module ; journalisé avec son auteur. Le bot l'applique dans les 10 secondes.
CREATE OR REPLACE FUNCTION panel_set_module(p_guild_id text, p_module text DEFAULT NULL, p_enabled boolean DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM panel_assert_admin(p_guild_id);

  IF p_module IS NULL OR p_module NOT IN ('antiraid', 'casino', 'phaethon', 'profiling') OR p_enabled IS NULL THEN
    RAISE EXCEPTION 'invalid module' USING ERRCODE = '22023';
  END IF;

  INSERT INTO guild_settings (guild_id) VALUES (p_guild_id) ON CONFLICT (guild_id) DO NOTHING;

  UPDATE guild_settings SET
    antiraid_enabled = CASE WHEN p_module = 'antiraid' THEN p_enabled ELSE antiraid_enabled END,
    casino_enabled = CASE WHEN p_module = 'casino' THEN p_enabled ELSE casino_enabled END,
    phaethon_enabled = CASE WHEN p_module = 'phaethon' THEN p_enabled ELSE phaethon_enabled END,
    profiling_enabled = CASE WHEN p_module = 'profiling' THEN p_enabled ELSE profiling_enabled END,
    updated_at = now()
  WHERE guild_id = p_guild_id;

  INSERT INTO audit_event (id, action, guild_id, occurred_at, actor_id, target_id, metadata)
  VALUES (gen_random_uuid(), 'settings.module', p_guild_id, now(), panel_caller_discord_id(), NULL,
          jsonb_build_object('module', p_module, 'enabled', p_enabled, 'source', 'panel'));

  RETURN panel_modules(p_guild_id);
END;
$$;
--> statement-breakpoint
-- Choisit le salon d'alertes parmi ceux où le bot peut écrire (`guild_channel`) ; NULL le retire. Journalisé.
CREATE OR REPLACE FUNCTION panel_set_alert_channel(p_guild_id text, p_channel_id text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM panel_assert_admin(p_guild_id);

  IF p_channel_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM guild_channel WHERE guild_id = p_guild_id AND channel_id = p_channel_id) THEN
    RAISE EXCEPTION 'invalid channel' USING ERRCODE = '22023';
  END IF;

  INSERT INTO guild_settings (guild_id) VALUES (p_guild_id) ON CONFLICT (guild_id) DO NOTHING;
  UPDATE guild_settings SET alert_channel_id = p_channel_id, updated_at = now() WHERE guild_id = p_guild_id;

  INSERT INTO audit_event (id, action, guild_id, occurred_at, actor_id, target_id, metadata)
  VALUES (gen_random_uuid(), 'settings.alerts', p_guild_id, now(), panel_caller_discord_id(), NULL,
          jsonb_build_object('channel', p_channel_id, 'source', 'panel'));

  RETURN panel_antiraid(p_guild_id);
END;
$$;
--> statement-breakpoint
-- Comme en 0021, avec le salon d'alertes choisi et les salons proposés.
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
    'alert_channel', s.alert_channel_id IS NOT NULL,
    'alert_channel_id', s.alert_channel_id
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
    'channels', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', c.channel_id, 'name', c.name, 'category', c.category) ORDER BY c.position, c.name)
      FROM guild_channel c
      WHERE c.guild_id = p_guild_id
    ), '[]'::jsonb),
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
-- Comme en 0020, refusé quand le module est coupé, avec les totaux depuis l'arrivée.
CREATE OR REPLACE FUNCTION panel_profiling(p_guild_id text, p_query text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_query text := lower(btrim(coalesce(p_query, '')));
  v_now timestamptz := now();
  v_today date := (now() AT TIME ZONE 'UTC')::date;
  v_caller text;
  v_members jsonb;
BEGIN
  PERFORM panel_assert_admin(p_guild_id);

  IF EXISTS (SELECT 1 FROM guild_settings WHERE guild_id = p_guild_id AND NOT profiling_enabled) THEN
    RAISE EXCEPTION 'module disabled' USING ERRCODE = '55000';
  END IF;

  IF char_length(v_query) > 100 THEN
    RAISE EXCEPTION 'invalid query' USING ERRCODE = '22023';
  END IF;

  v_caller := panel_caller_discord_id();

  IF NOT EXISTS (
    SELECT 1 FROM audit_event
    WHERE guild_id = p_guild_id AND action = 'profiling.viewed' AND actor_id IS NOT DISTINCT FROM v_caller
      AND occurred_at > v_now - interval '1 hour'
  ) THEN
    INSERT INTO audit_event (id, action, guild_id, occurred_at, actor_id, target_id, metadata)
    VALUES (gen_random_uuid(), 'profiling.viewed', p_guild_id, v_now, v_caller, NULL, jsonb_build_object('source', 'panel'));
  END IF;

  WITH activity AS (
    SELECT d.member_id,
      (sum(d.messages) FILTER (WHERE d.day > v_today - 30))::bigint AS messages,
      (sum(d.voice_seconds) FILTER (WHERE d.day > v_today - 30))::bigint AS voice_seconds,
      sum(d.messages)::bigint AS messages_kept,
      sum(d.voice_seconds)::bigint AS voice_kept
    FROM activity_daily d
    WHERE d.guild_id = p_guild_id
    GROUP BY d.member_id
  ),
  picked AS (
    SELECT
      p.member_id, p.display_name, p.username, p.avatar, coalesce(p.joined_at, p.first_seen_at) AS joined_at,
      p.last_active_at, p.role_names,
      coalesce(a.messages, 0) AS messages, coalesce(a.voice_seconds, 0) AS voice_seconds,
      coalesce(a.messages_kept, 0) AS messages_kept, coalesce(a.voice_kept, 0) AS voice_kept,
      row_number() OVER (
        ORDER BY coalesce(a.messages, 0) DESC, coalesce(a.voice_seconds, 0) DESC,
          lower(coalesce(p.display_name, p.username, '')), p.member_id
      ) AS rank
    FROM member_profile p
    LEFT JOIN activity a ON a.member_id = p.member_id
    WHERE p.guild_id = p_guild_id
      AND p.left_at IS NULL
      AND (
        v_query = ''
        OR p.member_id = v_query
        OR position(v_query IN lower(coalesce(p.display_name, ''))) > 0
        OR position(v_query IN lower(coalesce(p.username, ''))) > 0
      )
  )
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'member_id', m.member_id,
      'name', m.display_name,
      'username', m.username,
      'avatar', m.avatar,
      'joined_at', m.joined_at,
      'last_active_at', m.last_active_at,
      'roles', to_jsonb(m.role_names),
      'messages_30d', m.messages,
      'voice_minutes_30d', m.voice_seconds / 60,
      -- Depuis son arrivée : les résumés mensuels (détail de plus de 30 jours, déjà purgé) plus le détail encore gardé.
      'messages_total', m.messages_kept + coalesce((
        SELECT sum(am.messages) FROM activity_monthly am WHERE am.guild_id = p_guild_id AND am.member_id = m.member_id
      ), 0),
      'voice_minutes_total', (m.voice_kept + coalesce((
        SELECT sum(am.voice_seconds) FROM activity_monthly am WHERE am.guild_id = p_guild_id AND am.member_id = m.member_id
      ), 0)) / 60,
      'balance', coalesce((
        SELECT e.wallet + e.bank FROM economy_account e WHERE e.guild_id = p_guild_id AND e.member_id = m.member_id
      ), 0),
      'warnings', (
        SELECT count(*) FROM moderation_warning w WHERE w.guild_id = p_guild_id AND w.member_id = m.member_id
      ),
      'days', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'day', to_char(s.day, 'YYYY-MM-DD'),
            'messages', coalesce(d.messages, 0),
            'voice_minutes', coalesce(d.voice_seconds, 0) / 60
          ) ORDER BY s.day
        )
        FROM generate_series(v_today - 6, v_today, interval '1 day') AS s(day)
        LEFT JOIN activity_daily d ON d.guild_id = p_guild_id AND d.member_id = m.member_id AND d.day = s.day::date
      )
    ) ORDER BY m.rank
  ), '[]'::jsonb)
  INTO v_members
  FROM picked m
  WHERE m.rank <= CASE WHEN v_query = '' THEN 40 ELSE 20 END;

  RETURN jsonb_build_object(
    'generated_at', v_now,
    'query', nullif(v_query, ''),
    'members_present', (SELECT count(*) FROM member_profile p WHERE p.guild_id = p_guild_id AND p.left_at IS NULL),
    'members', v_members
  );
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION panel_modules(text) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION panel_set_module(text, text, boolean) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION panel_set_alert_channel(text, text) FROM PUBLIC;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION panel_modules(text) FROM anon;
    REVOKE ALL ON FUNCTION panel_set_module(text, text, boolean) FROM anon;
    REVOKE ALL ON FUNCTION panel_set_alert_channel(text, text) FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION panel_modules(text) TO authenticated;
    GRANT EXECUTE ON FUNCTION panel_set_module(text, text, boolean) TO authenticated;
    GRANT EXECUTE ON FUNCTION panel_set_alert_channel(text, text) TO authenticated;
  END IF;
END;
$$;

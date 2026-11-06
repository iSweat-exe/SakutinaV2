-- Panneau : Profiling. La fiche de chaque membre : nom, nom d'utilisateur, photo, rôles, date d'arrivée, messages et
-- temps vocal sur 30 jours (la durée de conservation de l'activité), solde, avertissements et messages par jour sur
-- 7 jours. Jamais le contenu d'un message.
--
-- `member_profile` garde désormais le nom d'utilisateur Discord et le nom des rôles du membre (du plus haut au plus
-- bas, sans @everyone) : le bot les écrit en même temps que le nom affiché et la photo. Effacés avec la fiche
-- (`/me forget`, purge des membres partis).
--
-- Lecture seule, réservée aux administrateurs du serveur. La consultation est journalisée (`profiling.viewed`, une
-- fois par heure et par administrateur), comme celle de Phaéthon.
-- Garde-fous vérifiés par test/database/postgres/panel-functions.test.ts : SECURITY DEFINER avec search_path
-- fixé, première instruction = PERFORM panel_assert_admin, EXECUTE retiré à PUBLIC.

ALTER TABLE member_profile ADD COLUMN IF NOT EXISTS username text;
--> statement-breakpoint
ALTER TABLE member_profile ADD COLUMN IF NOT EXISTS role_names text[] NOT NULL DEFAULT '{}';
--> statement-breakpoint
-- Sans recherche : les 40 membres présents qui ont écrit le plus sur 30 jours (puis le plus de vocal). Avec une recherche (nom affiché, nom
-- d'utilisateur ou identifiant exact) : les 20 premiers qui correspondent, actifs ou non.
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
    SELECT d.member_id, sum(d.messages)::bigint AS messages, sum(d.voice_seconds)::bigint AS voice_seconds
    FROM activity_daily d
    WHERE d.guild_id = p_guild_id AND d.day > v_today - 30
    GROUP BY d.member_id
  ),
  picked AS (
    SELECT
      p.member_id, p.display_name, p.username, p.avatar, coalesce(p.joined_at, p.first_seen_at) AS joined_at,
      p.last_active_at, p.role_names,
      coalesce(a.messages, 0) AS messages, coalesce(a.voice_seconds, 0) AS voice_seconds,
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
REVOKE ALL ON FUNCTION panel_profiling(text, text) FROM PUBLIC;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION panel_profiling(text, text) FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION panel_profiling(text, text) TO authenticated;
  END IF;
END;
$$;

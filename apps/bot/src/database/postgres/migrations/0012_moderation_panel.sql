-- Panneau de modération : sanctions actives (mutes et bannissements), file d'actions du panneau vers le bot,
-- et réglages de l'auto-modération par serveur.
--
-- `moderation_sanction` : un mute ou un bannissement et son état. Les événements d'audit sont purgés à 30 jours, un
--   bannissement permanent ne peut donc pas se déduire d'eux : on le tient ici, jusqu'à ce qu'il soit levé.
--   `moderator_id` vaut NULL pour une sanction posée dans Discord (auteur inconnu) et 'sakutina' pour l'auto-modération.
-- `moderation_command` : « lever cette sanction », demandé depuis le panneau. Le panneau n'a aucun accès à Discord :
--   il écrit la demande, le bot l'exécute dans les secondes qui suivent, journalise et clôt la demande.

CREATE TABLE IF NOT EXISTS moderation_sanction (
  id serial PRIMARY KEY,
  guild_id text NOT NULL,
  member_id text NOT NULL,
  kind text NOT NULL,
  moderator_id text,
  reason text NOT NULL,
  created_at timestamptz NOT NULL,
  ends_at timestamptz,
  revoked_at timestamptz,
  revoked_by text,
  CONSTRAINT moderation_sanction_kind CHECK (kind IN ('mute', 'ban'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS moderation_sanction_guild_idx ON moderation_sanction (guild_id, revoked_at, created_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS moderation_sanction_member_idx ON moderation_sanction (guild_id, member_id, kind);
--> statement-breakpoint
ALTER TABLE moderation_sanction ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS moderation_command (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL,
  sanction_id integer NOT NULL,
  requested_by text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  processed_at timestamptz,
  error text,
  CONSTRAINT moderation_command_status CHECK (status IN ('pending', 'done', 'failed'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS moderation_command_pending_idx ON moderation_command (status, requested_at);
--> statement-breakpoint
ALTER TABLE moderation_command ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS automod_spam boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS automod_links boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS automod_words boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS automod_mentions boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS banned_words text[] NOT NULL DEFAULT '{}';
--> statement-breakpoint
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS default_mute_minutes integer NOT NULL DEFAULT 60;
--> statement-breakpoint
ALTER TABLE guild_settings ADD CONSTRAINT guild_settings_banned_words CHECK (cardinality(banned_words) <= 100);
--> statement-breakpoint
ALTER TABLE guild_settings ADD CONSTRAINT guild_settings_default_mute CHECK (default_mute_minutes BETWEEN 1 AND 40320);
--> statement-breakpoint
-- Réglages d'auto-modération sous forme de JSON, pour le panneau.
CREATE OR REPLACE FUNCTION panel_automod_json(p_guild_id text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'spam', coalesce(s.automod_spam, false),
    'links', coalesce(s.automod_links, false),
    'words', coalesce(s.automod_words, false),
    'mentions', coalesce(s.automod_mentions, false),
    'banned_words', to_jsonb(coalesce(s.banned_words, '{}'::text[])),
    'mute_minutes', coalesce(s.default_mute_minutes, 60)
  )
  INTO v_result
  FROM (SELECT 1) AS one
  LEFT JOIN guild_settings s ON s.guild_id = p_guild_id;

  RETURN v_result;
END;
$$;
--> statement-breakpoint
-- Modération d'un serveur : actions des 24 dernières heures, avertissements de 7 jours, sanctions actives
-- (mutes, bannissements, avertissements) avec le nom des membres, et réglages de l'auto-modération.
CREATE OR REPLACE FUNCTION panel_moderation(p_guild_id text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actions bigint;
  v_by_bot bigint;
  v_warnings bigint;
  v_warned bigint;
  v_sanctions jsonb;
BEGIN
  PERFORM panel_assert_admin(p_guild_id);

  -- Actions réussies : le résultat est absent (avertissement…) ou « ok ». « Sakutina » = auto-modération.
  SELECT
    count(*),
    count(*) FILTER (WHERE action LIKE 'automod.%' OR actor_id IS NULL)
  INTO v_actions, v_by_bot
  FROM audit_event
  WHERE guild_id = p_guild_id
    AND occurred_at > now() - interval '24 hours'
    AND (action LIKE 'moderation.%' OR action LIKE 'automod.%')
    AND (metadata ->> 'result' IS NULL OR metadata ->> 'result' = 'ok');

  SELECT count(*), count(DISTINCT member_id) FILTER (WHERE n >= 2)
  INTO v_warnings, v_warned
  FROM (
    SELECT member_id, count(*) OVER (PARTITION BY member_id) AS n
    FROM moderation_warning
    WHERE guild_id = p_guild_id AND created_at > now() - interval '7 days'
  ) w;

  SELECT coalesce(jsonb_agg(s.item ORDER BY s.created_at DESC), '[]'::jsonb)
  INTO v_sanctions
  FROM (
    SELECT created_at, item
    FROM (
      SELECT
        x.created_at,
        jsonb_build_object(
          'id', x.kind || ':' || x.id,
          'kind', x.kind,
          'member_id', x.member_id,
          'name', p.display_name,
          'avatar', p.avatar,
          'reason', x.reason,
          'by', CASE WHEN x.moderator_id IS NULL THEN 'Discord' WHEN x.moderator_id = 'sakutina' THEN 'Sakutina' ELSE coalesce(m.display_name, 'Moderator …' || right(x.moderator_id, 6)) END,
          'created_at', x.created_at,
          'ends_at', x.ends_at,
          'revoke_status', x.revoke_status
        ) AS item
      FROM (
        SELECT
          'mute'::text AS kind, s.id, s.member_id, s.moderator_id, s.reason, s.created_at, s.ends_at,
          (SELECT c.status FROM moderation_command c WHERE c.guild_id = s.guild_id AND c.sanction_id = s.id AND c.status <> 'done' ORDER BY c.requested_at DESC LIMIT 1) AS revoke_status,
          s.guild_id
        FROM moderation_sanction s
        WHERE s.guild_id = p_guild_id AND s.kind = 'mute' AND s.revoked_at IS NULL AND s.ends_at > now()
        UNION ALL
        SELECT
          'ban', s.id, s.member_id, s.moderator_id, s.reason, s.created_at, s.ends_at,
          (SELECT c.status FROM moderation_command c WHERE c.guild_id = s.guild_id AND c.sanction_id = s.id AND c.status <> 'done' ORDER BY c.requested_at DESC LIMIT 1),
          s.guild_id
        FROM moderation_sanction s
        WHERE s.guild_id = p_guild_id AND s.kind = 'ban' AND s.revoked_at IS NULL
        UNION ALL
        SELECT 'warn', w.id, w.member_id, w.moderator_id, w.reason, w.created_at, w.created_at + interval '365 days', NULL, w.guild_id
        FROM moderation_warning w
        WHERE w.guild_id = p_guild_id AND w.created_at > now() - interval '365 days'
      ) x
      LEFT JOIN member_profile p ON p.guild_id = x.guild_id AND p.member_id = x.member_id
      LEFT JOIN member_profile m ON m.guild_id = x.guild_id AND m.member_id = x.moderator_id
      ORDER BY x.created_at DESC
      LIMIT 100
    ) limited
  ) s;

  RETURN jsonb_build_object(
    'generated_at', now(),
    'actions_24h', v_actions,
    'actions_by_bot_24h', v_by_bot,
    'warnings_7d', v_warnings,
    'warned_members_2plus', v_warned,
    'sanctions', v_sanctions,
    'automod', panel_automod_json(p_guild_id)
  );
END;
$$;
--> statement-breakpoint
-- Auto-modération. Chaque argument vaut NULL pour « ne pas changer ». Les mots interdits remplacent la liste :
-- minuscules, sans doublon, 1 à 32 caractères, 100 au plus ; sinon refus (SQLSTATE 22023).
CREATE OR REPLACE FUNCTION panel_set_automod(
  p_guild_id text,
  p_spam boolean DEFAULT NULL,
  p_links boolean DEFAULT NULL,
  p_words boolean DEFAULT NULL,
  p_mentions boolean DEFAULT NULL,
  p_banned_words text[] DEFAULT NULL,
  p_mute_minutes integer DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_words text[];
BEGIN
  PERFORM panel_assert_admin(p_guild_id);

  IF p_mute_minutes IS NOT NULL AND p_mute_minutes NOT BETWEEN 1 AND 40320 THEN
    RAISE EXCEPTION 'invalid mute duration' USING ERRCODE = '22023';
  END IF;

  IF p_banned_words IS NOT NULL THEN
    SELECT coalesce(array_agg(DISTINCT w ORDER BY w), '{}'::text[])
    INTO v_words
    FROM (SELECT lower(btrim(x)) AS w FROM unnest(p_banned_words) AS x) t
    WHERE w <> '';

    IF cardinality(v_words) > 100 OR EXISTS (SELECT 1 FROM unnest(v_words) AS w WHERE char_length(w) > 32) THEN
      RAISE EXCEPTION 'invalid banned words' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_spam IS NOT NULL OR p_links IS NOT NULL OR p_words IS NOT NULL OR p_mentions IS NOT NULL
     OR v_words IS NOT NULL OR p_mute_minutes IS NOT NULL THEN
    INSERT INTO guild_settings (guild_id, automod_spam, automod_links, automod_words, automod_mentions, banned_words, default_mute_minutes)
    VALUES (
      p_guild_id,
      coalesce(p_spam, false),
      coalesce(p_links, false),
      coalesce(p_words, false),
      coalesce(p_mentions, false),
      coalesce(v_words, '{}'::text[]),
      coalesce(p_mute_minutes, 60)
    )
    ON CONFLICT (guild_id) DO UPDATE SET
      automod_spam = coalesce(p_spam, guild_settings.automod_spam),
      automod_links = coalesce(p_links, guild_settings.automod_links),
      automod_words = coalesce(p_words, guild_settings.automod_words),
      automod_mentions = coalesce(p_mentions, guild_settings.automod_mentions),
      banned_words = coalesce(v_words, guild_settings.banned_words),
      default_mute_minutes = coalesce(p_mute_minutes, guild_settings.default_mute_minutes),
      updated_at = now();

    INSERT INTO audit_event (id, action, guild_id, occurred_at, actor_id, target_id, metadata)
    VALUES (
      gen_random_uuid(),
      'settings.automod',
      p_guild_id,
      now(),
      panel_caller_discord_id(),
      NULL,
      jsonb_strip_nulls(jsonb_build_object(
        'spam', p_spam,
        'links', p_links,
        'words', p_words,
        'mentions', p_mentions,
        'banned_words_count', cardinality(v_words),
        'mute_minutes', p_mute_minutes,
        'source', 'panel'
      ))
    );
  END IF;

  RETURN panel_automod_json(p_guild_id);
END;
$$;
--> statement-breakpoint
-- Lever une sanction depuis le panneau. Un avertissement est retiré tout de suite (la base seule le porte) ; un
-- mute ou un bannissement devient une demande que le bot exécute sur Discord. Renvoie {"status": "done"|"pending"}.
CREATE OR REPLACE FUNCTION panel_revoke_sanction(
  p_guild_id text,
  p_kind text DEFAULT NULL,
  p_id integer DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_member text;
  v_caller text := panel_caller_discord_id();
BEGIN
  PERFORM panel_assert_admin(p_guild_id);

  IF p_kind IS NULL OR p_kind NOT IN ('mute', 'ban', 'warn') OR p_id IS NULL THEN
    RAISE EXCEPTION 'invalid sanction' USING ERRCODE = '22023';
  END IF;

  IF p_kind = 'warn' THEN
    DELETE FROM moderation_warning WHERE id = p_id AND guild_id = p_guild_id RETURNING member_id INTO v_member;

    IF v_member IS NULL THEN
      RAISE EXCEPTION 'invalid sanction' USING ERRCODE = '22023';
    END IF;

    INSERT INTO audit_event (id, action, guild_id, occurred_at, actor_id, target_id, metadata)
    VALUES (gen_random_uuid(), 'moderation.unwarn', p_guild_id, now(), v_caller, v_member,
            jsonb_build_object('warning_id', p_id, 'result', 'ok', 'source', 'panel'));

    RETURN jsonb_build_object('status', 'done');
  END IF;

  SELECT s.member_id INTO v_member
  FROM moderation_sanction s
  WHERE s.id = p_id AND s.guild_id = p_guild_id AND s.kind = p_kind AND s.revoked_at IS NULL
    AND (s.ends_at IS NULL OR s.ends_at > now());

  IF v_member IS NULL THEN
    RAISE EXCEPTION 'invalid sanction' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM moderation_command c WHERE c.guild_id = p_guild_id AND c.sanction_id = p_id AND c.status = 'pending'
  ) THEN
    INSERT INTO moderation_command (guild_id, sanction_id, requested_by)
    VALUES (p_guild_id, p_id, coalesce(v_caller, 'unknown'));
  END IF;

  RETURN jsonb_build_object('status', 'pending');
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION panel_automod_json(text) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION panel_moderation(text) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION panel_set_automod(text, boolean, boolean, boolean, boolean, text[], integer) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION panel_revoke_sanction(text, text, integer) FROM PUBLIC;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION panel_automod_json(text) FROM anon;
    REVOKE ALL ON FUNCTION panel_moderation(text) FROM anon;
    REVOKE ALL ON FUNCTION panel_set_automod(text, boolean, boolean, boolean, boolean, text[], integer) FROM anon;
    REVOKE ALL ON FUNCTION panel_revoke_sanction(text, text, integer) FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    -- Aide interne, comme panel_assert_admin : jamais appelée directement par le panneau.
    REVOKE ALL ON FUNCTION panel_automod_json(text) FROM authenticated;
    GRANT EXECUTE ON FUNCTION panel_moderation(text) TO authenticated;
    GRANT EXECUTE ON FUNCTION panel_set_automod(text, boolean, boolean, boolean, boolean, text[], integer) TO authenticated;
    GRANT EXECUTE ON FUNCTION panel_revoke_sanction(text, text, integer) TO authenticated;
  END IF;
END;
$$;

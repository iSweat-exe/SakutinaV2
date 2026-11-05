-- Accès du panneau web à la base. Le panneau (Vercel) lit la base avec la session Supabase
-- de l'utilisateur connecté ; il n'a aucun secret de base de données.
--
-- Principe : les tables restent fermées (RLS sans politique). Le panneau n'appelle que les
-- fonctions `panel_*` ci-dessous. Chacune vérifie d'abord que l'appelant est un administrateur
-- du serveur (table `panel_admin`), puis renvoie un agrégat prêt à afficher.
--
-- Ajouter un administrateur du panneau (SQL editor de Supabase) :
--   INSERT INTO panel_admin (guild_id, discord_id, role) VALUES ('<serveur>', '<id Discord>', 'owner');

CREATE TABLE IF NOT EXISTS panel_admin (
  guild_id text NOT NULL,
  discord_id text NOT NULL,
  role text NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (guild_id, discord_id),
  CONSTRAINT panel_admin_role CHECK (role IN ('admin', 'owner'))
);
--> statement-breakpoint
ALTER TABLE panel_admin ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Rôle de l'appelant sur le serveur, ou NULL. L'identité vient de `auth.identities` (fournisseur
-- Discord), jamais de `user_metadata` que l'utilisateur peut modifier lui-même.
CREATE OR REPLACE FUNCTION panel_role(p_guild_id text) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_role text;
BEGIN
  SELECT a.role INTO v_role
  FROM panel_admin a
  JOIN auth.identities i ON i.provider = 'discord' AND i.provider_id = a.discord_id
  WHERE a.guild_id = p_guild_id AND i.user_id = auth.uid();

  RETURN v_role;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION panel_assert_admin(p_guild_id text) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF panel_role(p_guild_id) IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
END;
$$;
--> statement-breakpoint
-- Vue d'ensemble : messages des 24 dernières heures UTC (une valeur par heure), membres actifs,
-- membres présents et pièces en circulation.
CREATE OR REPLACE FUNCTION panel_overview(p_guild_id text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_now timestamp := date_trunc('hour', now() AT TIME ZONE 'utc');
  v_hourly jsonb;
  v_messages bigint;
  v_active bigint;
  v_members bigint;
  v_coins numeric;
BEGIN
  PERFORM panel_assert_admin(p_guild_id);

  SELECT jsonb_agg(
    jsonb_build_object(
      'at', to_char(s.slot, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'hour', extract(hour FROM s.slot)::int,
      'messages', coalesce(h.messages, 0)
    ) ORDER BY s.slot
  )
  INTO v_hourly
  FROM generate_series(v_now - interval '23 hours', v_now, interval '1 hour') AS s(slot)
  LEFT JOIN activity_hourly h
    ON h.guild_id = p_guild_id AND (h.day + make_interval(hours => h.hour::int)) = s.slot;

  SELECT coalesce(sum((e ->> 'messages')::bigint), 0) INTO v_messages FROM jsonb_array_elements(v_hourly) e;

  SELECT
    count(*) FILTER (WHERE left_at IS NULL AND last_active_at > now() - interval '24 hours'),
    count(*) FILTER (WHERE left_at IS NULL)
  INTO v_active, v_members
  FROM member_profile WHERE guild_id = p_guild_id;

  SELECT coalesce(sum(wallet + bank), 0) INTO v_coins FROM economy_account WHERE guild_id = p_guild_id;

  RETURN jsonb_build_object(
    'generated_at', now(),
    'messages_24h', v_messages,
    'active_members_24h', v_active,
    'members', v_members,
    'coins_total', v_coins,
    'hourly', v_hourly
  );
END;
$$;
--> statement-breakpoint
-- Dernières actions de modération du journal d'audit (les plus récentes d'abord).
CREATE OR REPLACE FUNCTION panel_recent_audit(p_guild_id text, p_limit integer DEFAULT 6) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM panel_assert_admin(p_guild_id);

  RETURN coalesce(
    (
      SELECT jsonb_agg(to_jsonb(r) ORDER BY r.occurred_at DESC)
      FROM (
        SELECT id, action, occurred_at, actor_id, target_id, metadata
        FROM audit_event
        WHERE guild_id = p_guild_id AND action LIKE 'moderation.%'
        ORDER BY occurred_at DESC
        LIMIT least(greatest(p_limit, 1), 50)
      ) r
    ),
    '[]'::jsonb
  );
END;
$$;
--> statement-breakpoint
-- Par défaut Postgres laisse tout le monde exécuter une fonction, et Supabase l'ouvre en plus à
-- `anon` et `authenticated` : on ferme tout, puis on n'ouvre aux utilisateurs connectés que les
-- fonctions destinées au panneau (les autres sont des aides internes).
REVOKE ALL ON FUNCTION panel_role(text), panel_assert_admin(text), panel_overview(text), panel_recent_audit(text, integer) FROM PUBLIC;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION panel_role(text), panel_assert_admin(text), panel_overview(text), panel_recent_audit(text, integer) FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION panel_assert_admin(text) FROM authenticated;
    GRANT EXECUTE ON FUNCTION panel_role(text), panel_overview(text), panel_recent_audit(text, integer) TO authenticated;
  END IF;
END;
$$;

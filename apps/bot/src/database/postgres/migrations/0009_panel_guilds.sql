-- Panneau multi-serveur : les serveurs que l'appelant peut gérer, et la fiche d'un serveur.
-- Le panneau n'a aucun accès direct aux tables : ces fonctions sont sa seule porte d'entrée.
-- Garde-fous vérifiés par test/database/postgres/panel-functions.test.ts : SECURITY DEFINER avec search_path
-- fixé, EXECUTE retiré à PUBLIC ; première instruction = PERFORM panel_assert_admin(p_guild_id) pour une
-- fonction d'un serveur, PERFORM panel_assert_signed_in() pour une fonction « de l'appelant ».

-- Refuse un appel sans session Discord (anonyme, ou connecté par un autre fournisseur).
CREATE OR REPLACE FUNCTION panel_assert_signed_in() RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.identities i WHERE i.provider = 'discord' AND i.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
END;
$$;
--> statement-breakpoint
-- Fiche d'un serveur (barre latérale du panneau). `name` est NULL si le bot n'y est pas
-- (accès par panel_admin seulement) : le panneau affiche alors l'identifiant.
CREATE OR REPLACE FUNCTION panel_guild(p_guild_id text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_result jsonb;
BEGIN
  PERFORM panel_assert_admin(p_guild_id);

  SELECT jsonb_build_object(
    'id', p_guild_id,
    'name', g.name,
    'icon', g.icon,
    'banner', g.banner,
    'member_count', g.member_count,
    'role', panel_role(p_guild_id)
  ) INTO v_result
  FROM (SELECT 1) AS one
  LEFT JOIN bot_guild g ON g.guild_id = p_guild_id;

  RETURN v_result;
END;
$$;
--> statement-breakpoint
-- Serveurs où le bot est présent et que l'appelant peut gérer (propriétaire, gestionnaire ou panel_admin).
-- Ne renvoie jamais que les serveurs de l'appelant : c'est la page de choix du serveur.
CREATE OR REPLACE FUNCTION panel_my_guilds() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM panel_assert_signed_in();

  RETURN coalesce(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', g.guild_id,
          'name', g.name,
          'icon', g.icon,
          'banner', g.banner,
          'member_count', g.member_count,
          'role', r.role
        )
        ORDER BY lower(g.name), g.guild_id
      )
      FROM bot_guild g
      CROSS JOIN LATERAL (SELECT panel_role(g.guild_id) AS role) r
      WHERE r.role IS NOT NULL
    ),
    '[]'::jsonb
  );
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION panel_assert_signed_in() FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION panel_guild(text) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION panel_my_guilds() FROM PUBLIC;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION panel_assert_signed_in() FROM anon;
    REVOKE ALL ON FUNCTION panel_guild(text) FROM anon;
    REVOKE ALL ON FUNCTION panel_my_guilds() FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    -- Aide interne, comme panel_assert_admin : jamais appelée directement par le panneau.
    REVOKE ALL ON FUNCTION panel_assert_signed_in() FROM authenticated;
    GRANT EXECUTE ON FUNCTION panel_guild(text) TO authenticated;
    GRANT EXECUTE ON FUNCTION panel_my_guilds() TO authenticated;
  END IF;
END;
$$;

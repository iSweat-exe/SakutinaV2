-- Journal du tableau de bord : le nom et la photo des membres au lieu de bouts d'identifiants, et les actions de
-- l'auto-modération. Remplace la version de 0007 (une migration appliquée ne se modifie jamais).
--
-- `target_name` / `target_avatar` : le membre visé ; `actor_name` : qui a agi. NULL tant que le bot n'a pas vu le membre.

CREATE OR REPLACE FUNCTION panel_recent_audit(p_guild_id text, p_limit integer DEFAULT 6) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM panel_assert_admin(p_guild_id);

  RETURN coalesce(
    (
      SELECT jsonb_agg(to_jsonb(r) ORDER BY r.occurred_at DESC)
      FROM (
        SELECT
          e.id, e.action, e.occurred_at, e.actor_id, e.target_id, e.metadata,
          t.display_name AS target_name,
          t.avatar AS target_avatar,
          a.display_name AS actor_name
        FROM audit_event e
        LEFT JOIN member_profile t ON t.guild_id = e.guild_id AND t.member_id = e.target_id
        LEFT JOIN member_profile a ON a.guild_id = e.guild_id AND a.member_id = e.actor_id
        WHERE e.guild_id = p_guild_id AND (e.action LIKE 'moderation.%' OR e.action LIKE 'automod.%')
        ORDER BY e.occurred_at DESC
        LIMIT least(greatest(p_limit, 1), 50)
      ) r
    ),
    '[]'::jsonb
  );
END;
$$;

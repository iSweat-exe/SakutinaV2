-- Temps vocal par heure UTC : le graphique d'activité du panneau montre enfin le vocal, pas seulement les messages.
-- Agrégat anonyme du serveur (sans identifiant de membre), purgé avec le reste de `activity_hourly`.

ALTER TABLE activity_hourly ADD COLUMN IF NOT EXISTS voice_seconds integer NOT NULL DEFAULT 0;
--> statement-breakpoint
-- Même fonction qu'en 0007, avec les minutes vocales de chaque heure en plus (`voice_minutes`).
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
      'messages', coalesce(h.messages, 0),
      'voice_minutes', round(coalesce(h.voice_seconds, 0) / 60.0)::int
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

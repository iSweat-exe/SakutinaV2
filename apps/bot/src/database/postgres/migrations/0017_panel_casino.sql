-- Casino : un administrateur ouvre ou ferme chaque jeu et règle sa mise maximale depuis le panneau.
--
-- Les réglages vivent dans `guild_settings` (le bot les lit déjà, avec un cache de quelques secondes) : par jeu, une
-- colonne « ouvert » et une colonne « mise maximale ». Les valeurs par défaut sont celles d'avant cette migration
-- (tout ouvert, plafonds historiques) : aucun serveur ne change de comportement tant qu'on n'y touche pas. La mise
-- minimale reste de 10 pour tous (`MIN_BET` côté bot). Le plafond ne dépasse jamais 100 000.

ALTER TABLE guild_settings
  ADD COLUMN IF NOT EXISTS casino_slots_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS casino_slots_max_bet integer NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS casino_blackjack_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS casino_blackjack_max_bet integer NOT NULL DEFAULT 2000,
  ADD COLUMN IF NOT EXISTS casino_roulette_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS casino_roulette_max_bet integer NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS casino_coinflip_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS casino_coinflip_max_bet integer NOT NULL DEFAULT 250;
--> statement-breakpoint
ALTER TABLE guild_settings ADD CONSTRAINT guild_settings_casino_max_bets CHECK (
  casino_slots_max_bet BETWEEN 10 AND 100000
  AND casino_blackjack_max_bet BETWEEN 10 AND 100000
  AND casino_roulette_max_bet BETWEEN 10 AND 100000
  AND casino_coinflip_max_bet BETWEEN 10 AND 100000
);
--> statement-breakpoint
-- Le casino d'un serveur : chaque jeu (ouvert ou non, mise maximale, valeur par défaut) et ce qu'il a rapporté au
-- trésor depuis 24 h. Un serveur sans réglages reçoit les valeurs par défaut.
CREATE OR REPLACE FUNCTION panel_casino(p_guild_id text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_games jsonb;
BEGIN
  PERFORM panel_assert_admin(p_guild_id);

  SELECT jsonb_agg(
    jsonb_build_object(
      'game', d.game,
      'enabled', CASE d.game
        WHEN 'slots' THEN coalesce(s.casino_slots_enabled, true)
        WHEN 'blackjack' THEN coalesce(s.casino_blackjack_enabled, true)
        WHEN 'roulette' THEN coalesce(s.casino_roulette_enabled, true)
        ELSE coalesce(s.casino_coinflip_enabled, true)
      END,
      'max_bet', CASE d.game
        WHEN 'slots' THEN coalesce(s.casino_slots_max_bet, d.def)
        WHEN 'blackjack' THEN coalesce(s.casino_blackjack_max_bet, d.def)
        WHEN 'roulette' THEN coalesce(s.casino_roulette_max_bet, d.def)
        ELSE coalesce(s.casino_coinflip_max_bet, d.def)
      END,
      'default_max_bet', d.def,
      'rounds_24h', st.rounds,
      'house_net_24h', st.net
    ) ORDER BY d.ord
  )
  INTO v_games
  FROM (VALUES (1, 'slots', 500), (2, 'blackjack', 2000), (3, 'roulette', 1000), (4, 'coinflip', 250)) AS d(ord, game, def)
  LEFT JOIN guild_settings s ON s.guild_id = p_guild_id
  CROSS JOIN LATERAL (
    -- Une main de blackjack compte une fois (sa mise) ; les autres jeux écrivent une ligne par partie non nulle.
    SELECT
      count(*) FILTER (WHERE d.game <> 'blackjack' OR t.reason = 'casino:blackjack:bet') AS rounds,
      coalesce(sum(t.amount), 0) AS net
    FROM treasury_entry t
    WHERE t.guild_id = p_guild_id
      AND t.created_at > now() - interval '24 hours'
      AND t.reason LIKE 'casino:' || d.game || ':%'
  ) st;

  RETURN jsonb_build_object(
    'generated_at', now(),
    'currency_name', coalesce((SELECT s.currency_name FROM guild_settings s WHERE s.guild_id = p_guild_id), 'pièces'),
    'min_bet', 10,
    'bet_ceiling', 100000,
    'games', v_games
  );
END;
$$;
--> statement-breakpoint
-- Ouvre ou ferme un jeu, ou change sa mise maximale (les arguments omis ne changent rien). Journalisé avec son auteur.
-- Renvoie le casino à jour.
CREATE OR REPLACE FUNCTION panel_set_casino_game(
  p_guild_id text,
  p_game text DEFAULT NULL,
  p_enabled boolean DEFAULT NULL,
  p_max_bet integer DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM panel_assert_admin(p_guild_id);

  IF p_game IS NULL OR p_game NOT IN ('slots', 'blackjack', 'roulette', 'coinflip') THEN
    RAISE EXCEPTION 'invalid game' USING ERRCODE = '22023';
  END IF;
  IF p_max_bet IS NOT NULL AND p_max_bet NOT BETWEEN 10 AND 100000 THEN
    RAISE EXCEPTION 'invalid max bet' USING ERRCODE = '22023';
  END IF;

  IF p_enabled IS NOT NULL OR p_max_bet IS NOT NULL THEN
    INSERT INTO guild_settings (guild_id) VALUES (p_guild_id) ON CONFLICT (guild_id) DO NOTHING;

    UPDATE guild_settings SET
      casino_slots_enabled = CASE WHEN p_game = 'slots' THEN coalesce(p_enabled, casino_slots_enabled) ELSE casino_slots_enabled END,
      casino_slots_max_bet = CASE WHEN p_game = 'slots' THEN coalesce(p_max_bet, casino_slots_max_bet) ELSE casino_slots_max_bet END,
      casino_blackjack_enabled = CASE WHEN p_game = 'blackjack' THEN coalesce(p_enabled, casino_blackjack_enabled) ELSE casino_blackjack_enabled END,
      casino_blackjack_max_bet = CASE WHEN p_game = 'blackjack' THEN coalesce(p_max_bet, casino_blackjack_max_bet) ELSE casino_blackjack_max_bet END,
      casino_roulette_enabled = CASE WHEN p_game = 'roulette' THEN coalesce(p_enabled, casino_roulette_enabled) ELSE casino_roulette_enabled END,
      casino_roulette_max_bet = CASE WHEN p_game = 'roulette' THEN coalesce(p_max_bet, casino_roulette_max_bet) ELSE casino_roulette_max_bet END,
      casino_coinflip_enabled = CASE WHEN p_game = 'coinflip' THEN coalesce(p_enabled, casino_coinflip_enabled) ELSE casino_coinflip_enabled END,
      casino_coinflip_max_bet = CASE WHEN p_game = 'coinflip' THEN coalesce(p_max_bet, casino_coinflip_max_bet) ELSE casino_coinflip_max_bet END,
      updated_at = now()
    WHERE guild_id = p_guild_id;

    INSERT INTO audit_event (id, action, guild_id, occurred_at, actor_id, target_id, metadata)
    VALUES (
      gen_random_uuid(),
      'settings.casino',
      p_guild_id,
      now(),
      panel_caller_discord_id(),
      NULL,
      jsonb_strip_nulls(jsonb_build_object(
        'game', p_game,
        'enabled', p_enabled,
        'max_bet', p_max_bet,
        'source', 'panel'
      ))
    );
  END IF;

  RETURN panel_casino(p_guild_id);
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION panel_casino(text) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION panel_set_casino_game(text, text, boolean, integer) FROM PUBLIC;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION panel_casino(text) FROM anon;
    REVOKE ALL ON FUNCTION panel_set_casino_game(text, text, boolean, integer) FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION panel_casino(text) TO authenticated;
    GRANT EXECUTE ON FUNCTION panel_set_casino_game(text, text, boolean, integer) TO authenticated;
  END IF;
END;
$$;

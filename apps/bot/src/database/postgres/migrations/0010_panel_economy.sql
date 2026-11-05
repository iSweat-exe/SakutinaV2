-- Panneau : économie d'un serveur. Lecture seule, réservée aux administrateurs du serveur.
-- Le panneau n'a aucun accès direct aux tables : cette fonction est sa seule porte d'entrée.
-- Garde-fous vérifiés par test/database/postgres/panel-functions.test.ts : SECURITY DEFINER avec search_path
-- fixé, première instruction = PERFORM panel_assert_admin, EXECUTE retiré à PUBLIC.
--
-- Renvoie des agrégats prêts à afficher : pièces en circulation (total, porteurs, moyenne), gains et
-- dépenses des dernières 24 h, circulation de chacun des 7 derniers jours (UTC) et les 5 plus gros soldes.
--
-- La circulation d'un jour passé se déduit du grand livre (immuable) : « total actuel moins les flux
-- survenus depuis la fin de ce jour ». Seuls `earn` (+) et `spend` (−) changent le total ; `deposit` et
-- `withdraw` ne font que déplacer des pièces entre portefeuille et banque.

CREATE OR REPLACE FUNCTION panel_economy(p_guild_id text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_today timestamp := date_trunc('day', now() AT TIME ZONE 'utc');
  v_total numeric;
  v_holders bigint;
  v_earned numeric;
  v_spent numeric;
  v_circulation jsonb;
  v_top jsonb;
BEGIN
  PERFORM panel_assert_admin(p_guild_id);

  SELECT coalesce(sum(wallet + bank), 0), count(*) FILTER (WHERE wallet + bank > 0)
  INTO v_total, v_holders
  FROM economy_account WHERE guild_id = p_guild_id;

  SELECT
    coalesce(sum(amount) FILTER (WHERE kind = 'earn'), 0),
    coalesce(sum(amount) FILTER (WHERE kind = 'spend'), 0)
  INTO v_earned, v_spent
  FROM economy_ledger
  WHERE guild_id = p_guild_id AND created_at > now() - interval '24 hours';

  SELECT jsonb_agg(
    jsonb_build_object(
      'day', to_char(d.day, 'YYYY-MM-DD'),
      'coins', v_total - coalesce(
        (
          SELECT sum(CASE l.kind WHEN 'earn' THEN l.amount WHEN 'spend' THEN -l.amount ELSE 0 END)
          FROM economy_ledger l
          WHERE l.guild_id = p_guild_id AND l.created_at >= ((d.day + interval '1 day') AT TIME ZONE 'utc')
        ),
        0
      )
    ) ORDER BY d.day
  )
  INTO v_circulation
  FROM generate_series(v_today - interval '6 days', v_today, interval '1 day') AS d(day);

  SELECT coalesce(jsonb_agg(jsonb_build_object('member_id', t.member_id, 'coins', t.coins) ORDER BY t.coins DESC, t.member_id), '[]'::jsonb)
  INTO v_top
  FROM (
    SELECT member_id, wallet + bank AS coins
    FROM economy_account
    WHERE guild_id = p_guild_id AND wallet + bank > 0
    ORDER BY wallet + bank DESC, member_id
    LIMIT 5
  ) t;

  RETURN jsonb_build_object(
    'generated_at', now(),
    'coins_total', v_total,
    'holders', v_holders,
    'average', CASE WHEN v_holders > 0 THEN round(v_total / v_holders) ELSE 0 END,
    'earned_24h', v_earned,
    'spent_24h', v_spent,
    'circulation', v_circulation,
    'top', v_top
  );
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION panel_economy(text) FROM PUBLIC;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION panel_economy(text) FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION panel_economy(text) TO authenticated;
  END IF;
END;
$$;

-- Économie en circuit fermé (SB-CLE). Plus aucune pièce n'est créée à partir de rien :
--
-- - la réserve (`guild_treasury`) reçoit une dotation de lancement de 1 000 000 (`genesis`) et une dotation de 5 000
--   à chaque nouveau membre (`arrival`) : ce sont les deux seules créations, journalisées ;
-- - `/economy work` et `/economy daily` puisent dans la réserve, selon un budget par jour (`salary_budget_permille`)
--   partagé entre les membres actifs ;
-- - le casino a son propre compte (`casino_fund`, apport de départ de 100 000 pris dans la réserve), qui reçoit les
--   pertes et paie les gains sans jamais passer sous zéro, et une cagnotte de jackpot (5 % des pertes) ;
-- - l'action Casino (1 000 actions) vaut le solde du casino divisé par le nombre d'actions ; le serveur vend et
--   rachète au cours, l'argent passe par la réserve ; le graphique est gardé en bougies (`market_candle`) ;
-- - chaque dimanche (`economy_week_run`) : impôt sur la fortune au-delà d'un seuil, dividendes (20 % du bénéfice
--   du casino) et impôt du casino (30 %) versé à la réserve ;
-- - `/me forget` rend le solde à la réserve et efface le grand livre du membre (le déclencheur l'autorise pour ce
--   seul membre, pendant cette seule transaction).
--
-- `daily_reward` disparaît : la récompense quotidienne vient du budget des salaires.

ALTER TABLE guild_settings DROP COLUMN IF EXISTS daily_reward;
--> statement-breakpoint
ALTER TABLE guild_settings
  ADD COLUMN IF NOT EXISTS salary_budget_permille integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS wealth_tax_permille integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS idle_tax_permille integer NOT NULL DEFAULT 20;
--> statement-breakpoint
ALTER TABLE guild_settings ADD CONSTRAINT guild_settings_closed_economy CHECK (
  salary_budget_permille BETWEEN 0 AND 100
  AND wealth_tax_permille BETWEEN 0 AND 50
  AND idle_tax_permille BETWEEN 0 AND 100
);
--> statement-breakpoint
ALTER TABLE economy_account ADD COLUMN IF NOT EXISTS casino_shares bigint NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE economy_account ADD CONSTRAINT economy_account_casino_shares CHECK (casino_shares >= 0);
--> statement-breakpoint
-- Budget des salaires du jour (UTC) : fixé à la première réclamation, partagé entre `salary_active` membres.
ALTER TABLE guild_treasury
  ALTER COLUMN balance SET DEFAULT 1000000,
  ADD COLUMN IF NOT EXISTS salary_day date,
  ADD COLUMN IF NOT EXISTS salary_budget bigint,
  ADD COLUMN IF NOT EXISTS salary_paid bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS salary_active integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE guild_treasury ADD CONSTRAINT guild_treasury_salary CHECK (
  salary_paid >= 0 AND salary_active >= 1 AND (salary_budget IS NULL OR salary_paid <= salary_budget)
);
--> statement-breakpoint
-- Une seule dotation d'arrivée par membre (un membre effacé par `/me forget` n'a plus d'identifiant ici).
CREATE UNIQUE INDEX IF NOT EXISTS treasury_entry_arrival_idx ON treasury_entry (guild_id, member_id) WHERE reason = 'arrival';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS casino_fund (
  guild_id text PRIMARY KEY,
  -- Compte du casino : le cours de l'action est `balance / shares`.
  balance bigint NOT NULL DEFAULT 0,
  -- Cagnotte de la machine à sous.
  jackpot bigint NOT NULL DEFAULT 0,
  shares bigint NOT NULL DEFAULT 1000,
  -- Actions encore détenues par le serveur (à vendre).
  server_shares bigint NOT NULL DEFAULT 1000,
  -- Jour (UTC) du compteur de perte du jour, solde du matin et résultat depuis.
  day date,
  day_start bigint NOT NULL DEFAULT 0,
  day_net bigint NOT NULL DEFAULT 0,
  -- Résultat des parties depuis le dernier passage du dimanche, et perte reportée.
  week_net bigint NOT NULL DEFAULT 0,
  carried_loss bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT casino_fund_balances CHECK (balance >= 0 AND jackpot >= 0 AND carried_loss >= 0),
  CONSTRAINT casino_fund_shares CHECK (shares > 0 AND server_shares BETWEEN 0 AND shares)
);
--> statement-breakpoint
-- Journal du casino et du jackpot (montant signé : positif = entrée).
CREATE TABLE IF NOT EXISTS casino_entry (
  seq bigint GENERATED ALWAYS AS IDENTITY,
  id uuid PRIMARY KEY,
  guild_id text NOT NULL,
  pool text NOT NULL,
  amount bigint NOT NULL,
  -- `seed`, `casino:<jeu>:<issue>`, `dividend`, `tax`.
  reason text NOT NULL,
  member_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT casino_entry_pool CHECK (pool IN ('casino', 'jackpot')),
  CONSTRAINT casino_entry_amount_not_zero CHECK (amount <> 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS casino_entry_guild_idx ON casino_entry (guild_id, seq DESC);
--> statement-breakpoint
-- Bougies du cours de l'action Casino, en centièmes de pièce : 15 min (gardées 30 jours) et jour (gardées).
CREATE TABLE IF NOT EXISTS market_candle (
  guild_id text NOT NULL,
  period text NOT NULL,
  bucket timestamptz NOT NULL,
  open bigint NOT NULL,
  high bigint NOT NULL,
  low bigint NOT NULL,
  close bigint NOT NULL,
  volume bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, period, bucket),
  CONSTRAINT market_candle_period CHECK (period IN ('15m', '1d')),
  CONSTRAINT market_candle_prices CHECK (low >= 0 AND low <= high AND volume >= 0)
);
--> statement-breakpoint
-- Passage du dimanche : un par serveur et par semaine.
CREATE TABLE IF NOT EXISTS economy_week_run (
  guild_id text NOT NULL,
  week date NOT NULL,
  members_taxed integer NOT NULL DEFAULT 0,
  threshold bigint NOT NULL DEFAULT 0,
  wealth_tax bigint NOT NULL DEFAULT 0,
  profit bigint NOT NULL DEFAULT 0,
  dividends bigint NOT NULL DEFAULT 0,
  casino_tax bigint NOT NULL DEFAULT 0,
  carried_loss bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (guild_id, week)
);
--> statement-breakpoint
ALTER TABLE casino_fund ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE casino_entry ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE market_candle ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE economy_week_run ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Serveurs déjà là : la dotation de lancement s'ajoute à leur trésor, puis l'apport du casino en sort.
INSERT INTO treasury_entry (id, guild_id, amount, reason)
SELECT gen_random_uuid(), t.guild_id, 1000000, 'genesis' FROM guild_treasury t;
--> statement-breakpoint
INSERT INTO treasury_entry (id, guild_id, amount, reason)
SELECT gen_random_uuid(), t.guild_id, -100000, 'casino:seed' FROM guild_treasury t;
--> statement-breakpoint
UPDATE guild_treasury SET balance = balance + 900000, updated_at = now();
--> statement-breakpoint
INSERT INTO casino_fund (guild_id, balance, day_start) SELECT t.guild_id, 100000, 100000 FROM guild_treasury t ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO casino_entry (id, guild_id, pool, amount, reason) SELECT gen_random_uuid(), f.guild_id, 'casino', f.balance, 'seed' FROM casino_fund f;
--> statement-breakpoint
-- Un nouveau trésor naît avec sa dotation de lancement (journalisée), puis ouvre le casino avec son apport.
CREATE OR REPLACE FUNCTION guild_treasury_genesis() RETURNS trigger AS $$
DECLARE
  v_seed bigint := least(100000, NEW.balance);
  v_inserted integer;
BEGIN
  IF NEW.balance > 0 THEN
    INSERT INTO treasury_entry (id, guild_id, amount, reason) VALUES (gen_random_uuid(), NEW.guild_id, NEW.balance, 'genesis');
  END IF;

  INSERT INTO casino_fund (guild_id, balance, day_start) VALUES (NEW.guild_id, v_seed, v_seed) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted > 0 AND v_seed > 0 THEN
    UPDATE guild_treasury SET balance = balance - v_seed WHERE guild_id = NEW.guild_id;
    INSERT INTO treasury_entry (id, guild_id, amount, reason) VALUES (gen_random_uuid(), NEW.guild_id, -v_seed, 'casino:seed');
    INSERT INTO casino_entry (id, guild_id, pool, amount, reason) VALUES (gen_random_uuid(), NEW.guild_id, 'casino', v_seed, 'seed');
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER guild_treasury_genesis
AFTER INSERT ON guild_treasury
FOR EACH ROW EXECUTE FUNCTION guild_treasury_genesis();
--> statement-breakpoint
-- `/me forget` : la transaction du bot pose `sakutina.forget` = « serveur:membre ». Seules les lignes de ce membre
-- peuvent alors être effacées du grand livre, et son identifiant retiré des journaux des caisses. Rien d'autre.
CREATE OR REPLACE FUNCTION economy_ledger_immutable() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('sakutina.forget', true) = OLD.guild_id || ':' || OLD.member_id THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'economy_ledger is immutable';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION treasury_entry_immutable() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND current_setting('sakutina.forget', true) = OLD.guild_id || ':' || OLD.member_id
     AND NEW.member_id IS NULL
     AND NEW.id = OLD.id AND NEW.guild_id = OLD.guild_id AND NEW.amount = OLD.amount AND NEW.reason = OLD.reason
     AND NEW.actor_id IS NOT DISTINCT FROM OLD.actor_id AND NEW.note IS NOT DISTINCT FROM OLD.note
     AND NEW.created_at = OLD.created_at THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'treasury_entry is immutable';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION casino_entry_immutable() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND current_setting('sakutina.forget', true) = OLD.guild_id || ':' || OLD.member_id
     AND NEW.member_id IS NULL
     AND NEW.id = OLD.id AND NEW.guild_id = OLD.guild_id AND NEW.pool = OLD.pool AND NEW.amount = OLD.amount
     AND NEW.reason = OLD.reason AND NEW.created_at = OLD.created_at THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'casino_entry is immutable';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER casino_entry_no_change
BEFORE UPDATE OR DELETE ON casino_entry
FOR EACH ROW EXECUTE FUNCTION casino_entry_immutable();
--> statement-breakpoint
-- L'économie : pièces des membres, caisses du serveur et masse monétaire, circulation, plus riches, règles.
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
  v_rules jsonb;
  v_pools jsonb;
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

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object('member_id', t.member_id, 'coins', t.coins, 'name', t.display_name, 'avatar', t.avatar)
      ORDER BY t.coins DESC, t.member_id
    ),
    '[]'::jsonb
  )
  INTO v_top
  FROM (
    SELECT a.member_id, a.wallet + a.bank AS coins, p.display_name, p.avatar
    FROM economy_account a
    LEFT JOIN member_profile p ON p.guild_id = a.guild_id AND p.member_id = a.member_id
    WHERE a.guild_id = p_guild_id AND a.wallet + a.bank > 0
    ORDER BY a.wallet + a.bank DESC, a.member_id
    LIMIT 5
  ) t;

  SELECT jsonb_build_object(
    'currency_name', coalesce(s.currency_name, 'pièces'),
    'salary_budget_permille', coalesce(s.salary_budget_permille, 10),
    'starting_balance', coalesce(s.starting_balance, 0),
    'transfer_tax_percent', coalesce(s.transfer_tax_percent, 0),
    'bank_interest_permille', coalesce(s.bank_interest_permille, 0),
    'wealth_tax_permille', coalesce(s.wealth_tax_permille, 5),
    'idle_tax_permille', coalesce(s.idle_tax_permille, 20)
  )
  INTO v_rules
  FROM (SELECT 1) AS one
  LEFT JOIN guild_settings s ON s.guild_id = p_guild_id;

  SELECT jsonb_build_object(
    'reserve', coalesce((SELECT t.balance FROM guild_treasury t WHERE t.guild_id = p_guild_id), 0),
    'casino', coalesce((SELECT f.balance FROM casino_fund f WHERE f.guild_id = p_guild_id), 0),
    'jackpot', coalesce((SELECT f.jackpot FROM casino_fund f WHERE f.guild_id = p_guild_id), 0),
    'money_supply', coalesce(
      (SELECT sum(e.amount) FROM treasury_entry e WHERE e.guild_id = p_guild_id AND e.reason IN ('genesis', 'arrival')),
      0
    )
  )
  INTO v_pools;

  RETURN jsonb_build_object(
    'generated_at', now(),
    'coins_total', v_total,
    'holders', v_holders,
    'average', CASE WHEN v_holders > 0 THEN round(v_total / v_holders) ELSE 0 END,
    'earned_24h', v_earned,
    'spent_24h', v_spent,
    'circulation', v_circulation,
    'top', v_top,
    'rules', v_rules,
    'pools', v_pools
  );
END;
$$;
--> statement-breakpoint
DROP FUNCTION IF EXISTS panel_set_economy_rules(text, text, integer, integer, integer, integer);
--> statement-breakpoint
-- Change les règles de l'économie (les arguments omis ne changent rien), journalisé avec son auteur.
CREATE OR REPLACE FUNCTION panel_set_economy_rules(
  p_guild_id text,
  p_currency_name text DEFAULT NULL,
  p_salary_budget_permille integer DEFAULT NULL,
  p_starting_balance integer DEFAULT NULL,
  p_transfer_tax_percent integer DEFAULT NULL,
  p_bank_interest_permille integer DEFAULT NULL,
  p_wealth_tax_permille integer DEFAULT NULL,
  p_idle_tax_permille integer DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_name text := nullif(btrim(p_currency_name), '');
  v_rules jsonb;
BEGIN
  PERFORM panel_assert_admin(p_guild_id);

  IF p_currency_name IS NOT NULL AND (v_name IS NULL OR char_length(v_name) > 24) THEN
    RAISE EXCEPTION 'invalid currency name' USING ERRCODE = '22023';
  END IF;
  IF p_salary_budget_permille IS NOT NULL AND p_salary_budget_permille NOT BETWEEN 0 AND 100 THEN
    RAISE EXCEPTION 'invalid salary budget' USING ERRCODE = '22023';
  END IF;
  IF p_starting_balance IS NOT NULL AND p_starting_balance NOT BETWEEN 0 AND 1000000 THEN
    RAISE EXCEPTION 'invalid starting balance' USING ERRCODE = '22023';
  END IF;
  IF p_transfer_tax_percent IS NOT NULL AND p_transfer_tax_percent NOT BETWEEN 0 AND 25 THEN
    RAISE EXCEPTION 'invalid transfer tax' USING ERRCODE = '22023';
  END IF;
  IF p_bank_interest_permille IS NOT NULL AND p_bank_interest_permille NOT BETWEEN 0 AND 50 THEN
    RAISE EXCEPTION 'invalid bank interest' USING ERRCODE = '22023';
  END IF;
  IF p_wealth_tax_permille IS NOT NULL AND p_wealth_tax_permille NOT BETWEEN 0 AND 50 THEN
    RAISE EXCEPTION 'invalid wealth tax' USING ERRCODE = '22023';
  END IF;
  IF p_idle_tax_permille IS NOT NULL AND p_idle_tax_permille NOT BETWEEN 0 AND 100 THEN
    RAISE EXCEPTION 'invalid idle tax' USING ERRCODE = '22023';
  END IF;

  IF v_name IS NOT NULL OR p_salary_budget_permille IS NOT NULL OR p_starting_balance IS NOT NULL
     OR p_transfer_tax_percent IS NOT NULL OR p_bank_interest_permille IS NOT NULL
     OR p_wealth_tax_permille IS NOT NULL OR p_idle_tax_permille IS NOT NULL THEN
    INSERT INTO guild_settings (guild_id) VALUES (p_guild_id) ON CONFLICT (guild_id) DO NOTHING;

    UPDATE guild_settings SET
      currency_name = coalesce(v_name, currency_name),
      salary_budget_permille = coalesce(p_salary_budget_permille, salary_budget_permille),
      starting_balance = coalesce(p_starting_balance, starting_balance),
      transfer_tax_percent = coalesce(p_transfer_tax_percent, transfer_tax_percent),
      bank_interest_permille = coalesce(p_bank_interest_permille, bank_interest_permille),
      wealth_tax_permille = coalesce(p_wealth_tax_permille, wealth_tax_permille),
      idle_tax_permille = coalesce(p_idle_tax_permille, idle_tax_permille),
      updated_at = now()
    WHERE guild_id = p_guild_id;

    INSERT INTO audit_event (id, action, guild_id, occurred_at, actor_id, target_id, metadata)
    VALUES (
      gen_random_uuid(),
      'settings.economy',
      p_guild_id,
      now(),
      panel_caller_discord_id(),
      NULL,
      jsonb_strip_nulls(jsonb_build_object(
        'currency_name', v_name,
        'salary_budget_permille', p_salary_budget_permille,
        'starting_balance', p_starting_balance,
        'transfer_tax_percent', p_transfer_tax_percent,
        'bank_interest_permille', p_bank_interest_permille,
        'wealth_tax_permille', p_wealth_tax_permille,
        'idle_tax_permille', p_idle_tax_permille,
        'source', 'panel'
      ))
    );
  END IF;

  SELECT jsonb_build_object(
    'currency_name', coalesce(s.currency_name, 'pièces'),
    'salary_budget_permille', coalesce(s.salary_budget_permille, 10),
    'starting_balance', coalesce(s.starting_balance, 0),
    'transfer_tax_percent', coalesce(s.transfer_tax_percent, 0),
    'bank_interest_permille', coalesce(s.bank_interest_permille, 0),
    'wealth_tax_permille', coalesce(s.wealth_tax_permille, 5),
    'idle_tax_permille', coalesce(s.idle_tax_permille, 20)
  )
  INTO v_rules
  FROM (SELECT 1) AS one
  LEFT JOIN guild_settings s ON s.guild_id = p_guild_id;

  RETURN v_rules;
END;
$$;
--> statement-breakpoint
-- Le casino : chaque jeu (ouvert ou non, mise maximale réglée et mise que le compte du casino couvre vraiment,
-- valeur par défaut, parties et résultat des dernières 24 h) et le compte du casino lui-même.
CREATE OR REPLACE FUNCTION panel_casino(p_guild_id text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_games jsonb;
  v_fund bigint;
  v_jackpot bigint;
BEGIN
  PERFORM panel_assert_admin(p_guild_id);

  SELECT coalesce(max(f.balance), 0), coalesce(max(f.jackpot), 0) INTO v_fund, v_jackpot
  FROM casino_fund f WHERE f.guild_id = p_guild_id;

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
      'covered_bet', least(v_fund / 100, (v_fund * 20 / 100) / d.max_net),
      'default_max_bet', d.def,
      'rounds_24h', st.rounds,
      'house_net_24h', st.net
    ) ORDER BY d.ord
  )
  INTO v_games
  FROM (VALUES (1, 'slots', 500, 119), (2, 'blackjack', 2000, 2), (3, 'roulette', 1000, 35), (4, 'coinflip', 250, 1))
    AS d(ord, game, def, max_net)
  LEFT JOIN guild_settings s ON s.guild_id = p_guild_id
  CROSS JOIN LATERAL (
    -- Une main de blackjack compte une fois (sa mise) ; les autres jeux écrivent une ligne par partie non nulle.
    SELECT
      count(*) FILTER (WHERE d.game <> 'blackjack' OR c.reason = 'casino:blackjack:bet') AS rounds,
      coalesce(sum(c.amount), 0) AS net
    FROM casino_entry c
    WHERE c.guild_id = p_guild_id
      AND c.pool = 'casino'
      AND c.created_at > now() - interval '24 hours'
      AND c.reason LIKE 'casino:' || d.game || ':%'
  ) st;

  RETURN jsonb_build_object(
    'generated_at', now(),
    'currency_name', coalesce((SELECT s.currency_name FROM guild_settings s WHERE s.guild_id = p_guild_id), 'pièces'),
    'min_bet', 10,
    'bet_ceiling', 100000,
    'fund', v_fund,
    'jackpot', v_jackpot,
    'games', v_games
  );
END;
$$;
--> statement-breakpoint
-- L'action Casino : cours, actions, plus gros actionnaires et bougies de la période demandée (`15m`, `1H`, `1D`,
-- `1W` ; 80 au plus, les plus récentes). Les bougies d'une heure et d'une semaine regroupent celles de 15 min et du
-- jour. Les périodes sans mouvement n'ont pas de bougie : le panneau les comble au cours précédent.
CREATE OR REPLACE FUNCTION panel_market(p_guild_id text, p_period text DEFAULT '1H') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_period text := coalesce(p_period, '1H');
  v_candles jsonb;
  v_holders jsonb;
  v_fund casino_fund%ROWTYPE;
BEGIN
  PERFORM panel_assert_admin(p_guild_id);

  IF v_period NOT IN ('15m', '1H', '1D', '1W') THEN
    RAISE EXCEPTION 'invalid period' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_fund FROM casino_fund f WHERE f.guild_id = p_guild_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object('t', c.t, 'o', c.o, 'h', c.h, 'l', c.l, 'c', c.c, 'v', c.v) ORDER BY c.t), '[]'::jsonb)
  INTO v_candles
  FROM (
    SELECT * FROM (
      SELECT
        g.t,
        (array_agg(m.open ORDER BY m.bucket))[1] AS o,
        max(m.high) AS h,
        min(m.low) AS l,
        (array_agg(m.close ORDER BY m.bucket DESC))[1] AS c,
        sum(m.volume) AS v
      FROM market_candle m
      CROSS JOIN LATERAL (
        SELECT CASE v_period
          WHEN '1H' THEN date_trunc('hour', m.bucket AT TIME ZONE 'utc') AT TIME ZONE 'utc'
          WHEN '1W' THEN date_trunc('week', m.bucket AT TIME ZONE 'utc') AT TIME ZONE 'utc'
          ELSE m.bucket
        END AS t
      ) g
      WHERE m.guild_id = p_guild_id
        AND m.period = CASE WHEN v_period IN ('15m', '1H') THEN '15m' ELSE '1d' END
      GROUP BY g.t
      ORDER BY g.t DESC
      LIMIT 80
    ) recent
  ) c;

  SELECT coalesce(jsonb_agg(jsonb_build_object('member_id', h.member_id, 'shares', h.casino_shares, 'name', h.display_name, 'avatar', h.avatar)
    ORDER BY h.casino_shares DESC, h.member_id), '[]'::jsonb)
  INTO v_holders
  FROM (
    SELECT a.member_id, a.casino_shares, p.display_name, p.avatar
    FROM economy_account a
    LEFT JOIN member_profile p ON p.guild_id = a.guild_id AND p.member_id = a.member_id
    WHERE a.guild_id = p_guild_id AND a.casino_shares > 0
    ORDER BY a.casino_shares DESC, a.member_id
    LIMIT 5
  ) h;

  RETURN jsonb_build_object(
    'generated_at', now(),
    'currency_name', coalesce((SELECT s.currency_name FROM guild_settings s WHERE s.guild_id = p_guild_id), 'pièces'),
    'period', v_period,
    'opened', v_fund.guild_id IS NOT NULL,
    'fund', coalesce(v_fund.balance, 0),
    'jackpot', coalesce(v_fund.jackpot, 0),
    'shares', coalesce(v_fund.shares, 1000),
    'server_shares', coalesce(v_fund.server_shares, 1000),
    'week_net', coalesce(v_fund.week_net, 0),
    'price_cents', CASE WHEN coalesce(v_fund.shares, 0) > 0 THEN (v_fund.balance * 100) / v_fund.shares ELSE 0 END,
    'holders', v_holders,
    'candles', v_candles
  );
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION panel_economy(text) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION panel_set_economy_rules(text, text, integer, integer, integer, integer, integer, integer) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION panel_casino(text) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION panel_market(text, text) FROM PUBLIC;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION panel_economy(text) FROM anon;
    REVOKE ALL ON FUNCTION panel_set_economy_rules(text, text, integer, integer, integer, integer, integer, integer) FROM anon;
    REVOKE ALL ON FUNCTION panel_casino(text) FROM anon;
    REVOKE ALL ON FUNCTION panel_market(text, text) FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION panel_economy(text) TO authenticated;
    GRANT EXECUTE ON FUNCTION panel_set_economy_rules(text, text, integer, integer, integer, integer, integer, integer) TO authenticated;
    GRANT EXECUTE ON FUNCTION panel_casino(text) TO authenticated;
    GRANT EXECUTE ON FUNCTION panel_market(text, text) TO authenticated;
  END IF;
END;
$$;

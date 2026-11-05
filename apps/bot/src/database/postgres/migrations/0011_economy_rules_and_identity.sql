-- 1. Nom affiché et photo des membres (Top Holders, sanctions, avertissements du panneau).
--    Deux métadonnées de plus sur la fiche du membre : elles suivent sa conservation (purgées 30 jours après
--    son départ, effacées par /me forget). Jamais de contenu de message.
-- 2. Règles d'économie par serveur, réglées depuis le panneau et lues par le bot.

ALTER TABLE member_profile ADD COLUMN IF NOT EXISTS display_name text;
--> statement-breakpoint
ALTER TABLE member_profile ADD COLUMN IF NOT EXISTS avatar text;
--> statement-breakpoint
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS currency_name text NOT NULL DEFAULT 'pièces';
--> statement-breakpoint
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS daily_reward integer NOT NULL DEFAULT 200;
--> statement-breakpoint
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS starting_balance integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS transfer_tax_percent integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE guild_settings ADD CONSTRAINT guild_settings_currency_name CHECK (char_length(currency_name) BETWEEN 1 AND 24);
--> statement-breakpoint
ALTER TABLE guild_settings ADD CONSTRAINT guild_settings_daily_reward CHECK (daily_reward BETWEEN 0 AND 100000);
--> statement-breakpoint
ALTER TABLE guild_settings ADD CONSTRAINT guild_settings_starting_balance CHECK (starting_balance BETWEEN 0 AND 1000000);
--> statement-breakpoint
ALTER TABLE guild_settings ADD CONSTRAINT guild_settings_transfer_tax CHECK (transfer_tax_percent BETWEEN 0 AND 25);
--> statement-breakpoint
-- Économie d'un serveur : agrégats, plus gros soldes (avec nom et photo) et règles en vigueur.
-- Remplace la version de 0010 (une migration appliquée ne se modifie jamais).
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
    'daily_reward', coalesce(s.daily_reward, 200),
    'starting_balance', coalesce(s.starting_balance, 0),
    'transfer_tax_percent', coalesce(s.transfer_tax_percent, 0)
  )
  INTO v_rules
  FROM (SELECT 1) AS one
  LEFT JOIN guild_settings s ON s.guild_id = p_guild_id;

  RETURN jsonb_build_object(
    'generated_at', now(),
    'coins_total', v_total,
    'holders', v_holders,
    'average', CASE WHEN v_holders > 0 THEN round(v_total / v_holders) ELSE 0 END,
    'earned_24h', v_earned,
    'spent_24h', v_spent,
    'circulation', v_circulation,
    'top', v_top,
    'rules', v_rules
  );
END;
$$;
--> statement-breakpoint
-- Identité de la personne connectée côté Discord (l'auteur d'une modification du panneau).
CREATE OR REPLACE FUNCTION panel_caller_discord_id() RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_id text;
BEGIN
  SELECT i.provider_id INTO v_id FROM auth.identities i WHERE i.provider = 'discord' AND i.user_id = auth.uid() LIMIT 1;

  RETURN v_id;
END;
$$;
--> statement-breakpoint
-- Règles d'économie. Chaque argument vaut NULL pour « ne pas changer » ; une valeur hors limites est
-- refusée (SQLSTATE 22023), jamais rognée. Journalisé dans l'audit avec l'auteur.
CREATE OR REPLACE FUNCTION panel_set_economy_rules(
  p_guild_id text,
  p_currency_name text DEFAULT NULL,
  p_daily_reward integer DEFAULT NULL,
  p_starting_balance integer DEFAULT NULL,
  p_transfer_tax_percent integer DEFAULT NULL
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
  IF p_daily_reward IS NOT NULL AND p_daily_reward NOT BETWEEN 0 AND 100000 THEN
    RAISE EXCEPTION 'invalid daily reward' USING ERRCODE = '22023';
  END IF;
  IF p_starting_balance IS NOT NULL AND p_starting_balance NOT BETWEEN 0 AND 1000000 THEN
    RAISE EXCEPTION 'invalid starting balance' USING ERRCODE = '22023';
  END IF;
  IF p_transfer_tax_percent IS NOT NULL AND p_transfer_tax_percent NOT BETWEEN 0 AND 25 THEN
    RAISE EXCEPTION 'invalid transfer tax' USING ERRCODE = '22023';
  END IF;

  IF v_name IS NOT NULL OR p_daily_reward IS NOT NULL OR p_starting_balance IS NOT NULL OR p_transfer_tax_percent IS NOT NULL THEN
    INSERT INTO guild_settings (guild_id, currency_name, daily_reward, starting_balance, transfer_tax_percent)
    VALUES (
      p_guild_id,
      coalesce(v_name, 'pièces'),
      coalesce(p_daily_reward, 200),
      coalesce(p_starting_balance, 0),
      coalesce(p_transfer_tax_percent, 0)
    )
    ON CONFLICT (guild_id) DO UPDATE SET
      currency_name = coalesce(v_name, guild_settings.currency_name),
      daily_reward = coalesce(p_daily_reward, guild_settings.daily_reward),
      starting_balance = coalesce(p_starting_balance, guild_settings.starting_balance),
      transfer_tax_percent = coalesce(p_transfer_tax_percent, guild_settings.transfer_tax_percent),
      updated_at = now();

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
        'daily_reward', p_daily_reward,
        'starting_balance', p_starting_balance,
        'transfer_tax_percent', p_transfer_tax_percent,
        'source', 'panel'
      ))
    );
  END IF;

  SELECT jsonb_build_object(
    'currency_name', coalesce(s.currency_name, 'pièces'),
    'daily_reward', coalesce(s.daily_reward, 200),
    'starting_balance', coalesce(s.starting_balance, 0),
    'transfer_tax_percent', coalesce(s.transfer_tax_percent, 0)
  )
  INTO v_rules
  FROM (SELECT 1) AS one
  LEFT JOIN guild_settings s ON s.guild_id = p_guild_id;

  RETURN v_rules;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION panel_caller_discord_id() FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION panel_set_economy_rules(text, text, integer, integer, integer) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION panel_economy(text) FROM PUBLIC;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION panel_caller_discord_id() FROM anon;
    REVOKE ALL ON FUNCTION panel_set_economy_rules(text, text, integer, integer, integer) FROM anon;
    REVOKE ALL ON FUNCTION panel_economy(text) FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION panel_caller_discord_id() FROM authenticated;
    GRANT EXECUTE ON FUNCTION panel_set_economy_rules(text, text, integer, integer, integer) TO authenticated;
    GRANT EXECUTE ON FUNCTION panel_economy(text) TO authenticated;
  END IF;
END;
$$;

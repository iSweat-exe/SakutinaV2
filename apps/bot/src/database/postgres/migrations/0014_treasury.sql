-- Trésor du serveur : ce que le serveur garde au lieu de le détruire. Il reçoit la taxe des paiements et la
-- mise des jeux, et verse les gains (dans la limite de ce qu'il contient). Un administrateur peut en verser une
-- partie à un membre depuis le panneau.
--
-- Le trésor n'est pas un compte de membre : il n'entre ni dans le classement ni dans les pièces en circulation.
-- `guild_treasury` porte le solde ; `treasury_entry` est son journal (montant signé : positif = entrée).

CREATE TABLE IF NOT EXISTS guild_treasury (
  guild_id text PRIMARY KEY,
  balance bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT guild_treasury_balance_non_negative CHECK (balance >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS treasury_entry (
  -- Ordre d'insertion strict : `created_at` peut être identique entre deux écritures.
  seq bigint GENERATED ALWAYS AS IDENTITY,
  id uuid PRIMARY KEY,
  guild_id text NOT NULL,
  amount bigint NOT NULL,
  -- `tax`, `casino:<jeu>:<issue>` ou `payout`.
  reason text NOT NULL,
  -- Le membre concerné : celui qui a payé la taxe, qui a joué ou qui a reçu le versement.
  member_id text,
  -- Qui a décidé (versement depuis le panneau) ; NULL pour une écriture automatique.
  actor_id text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT treasury_entry_amount_not_zero CHECK (amount <> 0),
  CONSTRAINT treasury_entry_note_length CHECK (note IS NULL OR char_length(note) <= 100)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS treasury_entry_guild_idx ON treasury_entry (guild_id, seq DESC);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION treasury_entry_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'treasury_entry is immutable';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER treasury_entry_no_change
BEFORE UPDATE OR DELETE ON treasury_entry
FOR EACH ROW EXECUTE FUNCTION treasury_entry_immutable();
--> statement-breakpoint
ALTER TABLE guild_treasury ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE treasury_entry ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Le trésor : solde, flux des dernières 24 h et les derniers mouvements (avec nom et photo des membres).
CREATE OR REPLACE FUNCTION panel_treasury(p_guild_id text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_balance bigint;
  v_in numeric;
  v_out numeric;
  v_recent jsonb;
BEGIN
  PERFORM panel_assert_admin(p_guild_id);

  SELECT coalesce((SELECT t.balance FROM guild_treasury t WHERE t.guild_id = p_guild_id), 0) INTO v_balance;

  SELECT
    coalesce(sum(amount) FILTER (WHERE amount > 0), 0),
    coalesce(-sum(amount) FILTER (WHERE amount < 0), 0)
  INTO v_in, v_out
  FROM treasury_entry
  WHERE guild_id = p_guild_id AND created_at > now() - interval '24 hours';

  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.seq DESC), '[]'::jsonb)
  INTO v_recent
  FROM (
    SELECT
      e.seq, e.id, e.amount, e.reason, e.note, e.created_at, e.member_id, e.actor_id,
      m.display_name AS member_name,
      m.avatar AS member_avatar,
      a.display_name AS actor_name
    FROM treasury_entry e
    LEFT JOIN member_profile m ON m.guild_id = e.guild_id AND m.member_id = e.member_id
    LEFT JOIN member_profile a ON a.guild_id = e.guild_id AND a.member_id = e.actor_id
    WHERE e.guild_id = p_guild_id
    ORDER BY e.seq DESC
    LIMIT 8
  ) r;

  RETURN jsonb_build_object(
    'generated_at', now(),
    'balance', v_balance,
    'in_24h', v_in,
    'out_24h', v_out,
    'recent', v_recent
  );
END;
$$;
--> statement-breakpoint
-- Cherche un membre connu du serveur, par nom (ou identifiant exact), pour choisir qui reçoit un versement.
CREATE OR REPLACE FUNCTION panel_find_members(p_guild_id text, p_query text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_query text := btrim(coalesce(p_query, ''));
BEGIN
  PERFORM panel_assert_admin(p_guild_id);

  IF char_length(v_query) < 2 THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN coalesce(
    (
      SELECT jsonb_agg(jsonb_build_object('member_id', r.member_id, 'name', r.display_name, 'avatar', r.avatar) ORDER BY r.display_name, r.member_id)
      FROM (
        SELECT p.member_id, p.display_name, p.avatar
        FROM member_profile p
        WHERE p.guild_id = p_guild_id
          AND (
            p.member_id = v_query
            OR (p.display_name IS NOT NULL AND position(lower(v_query) IN lower(p.display_name)) > 0)
          )
        ORDER BY p.display_name, p.member_id
        LIMIT 8
      ) r
    ),
    '[]'::jsonb
  );
END;
$$;
--> statement-breakpoint
-- Verse une somme du trésor au portefeuille d'un membre. Refusé (SQLSTATE 22023) si le membre est inconnu du
-- serveur, si le montant est hors limites, si le trésor ne contient pas assez ou si le portefeuille dépasserait
-- le plafond. Le compte est verrouillé avant le trésor, comme le fait le bot : jamais d'interblocage.
-- Écrit le grand livre du membre, le journal du trésor et l'audit (avec l'auteur) d'un seul tenant.
CREATE OR REPLACE FUNCTION panel_treasury_pay_out(
  p_guild_id text,
  p_member_id text DEFAULT NULL,
  p_amount bigint DEFAULT NULL,
  p_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_caller text := panel_caller_discord_id();
  v_note text := nullif(btrim(p_note), '');
  v_id uuid := gen_random_uuid();
  v_wallet bigint;
  v_bank bigint;
  v_balance bigint;
BEGIN
  PERFORM panel_assert_admin(p_guild_id);

  IF p_member_id IS NULL OR p_amount IS NULL OR p_amount NOT BETWEEN 1 AND 1000000000000 THEN
    RAISE EXCEPTION 'invalid payout' USING ERRCODE = '22023';
  END IF;
  IF v_note IS NOT NULL AND char_length(v_note) > 100 THEN
    RAISE EXCEPTION 'invalid note' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM member_profile p WHERE p.guild_id = p_guild_id AND p.member_id = p_member_id) THEN
    RAISE EXCEPTION 'invalid member' USING ERRCODE = '22023';
  END IF;

  INSERT INTO economy_account (guild_id, member_id) VALUES (p_guild_id, p_member_id) ON CONFLICT DO NOTHING;
  SELECT a.wallet, a.bank INTO v_wallet, v_bank
  FROM economy_account a WHERE a.guild_id = p_guild_id AND a.member_id = p_member_id FOR UPDATE;

  INSERT INTO guild_treasury (guild_id) VALUES (p_guild_id) ON CONFLICT DO NOTHING;
  SELECT t.balance INTO v_balance FROM guild_treasury t WHERE t.guild_id = p_guild_id FOR UPDATE;

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'insufficient treasury' USING ERRCODE = '22023';
  END IF;
  IF v_wallet + p_amount > 1000000000000 THEN
    RAISE EXCEPTION 'balance limit' USING ERRCODE = '22023';
  END IF;

  UPDATE guild_treasury SET balance = balance - p_amount, updated_at = now() WHERE guild_id = p_guild_id;
  UPDATE economy_account SET wallet = wallet + p_amount, updated_at = now()
  WHERE guild_id = p_guild_id AND member_id = p_member_id;

  INSERT INTO economy_ledger (id, guild_id, member_id, kind, amount, wallet_after, bank_after, reason, idempotency_key, created_at)
  VALUES (gen_random_uuid(), p_guild_id, p_member_id, 'earn', p_amount, v_wallet + p_amount, v_bank,
          'treasury:payout', 'treasury:payout:' || v_id, now());

  INSERT INTO treasury_entry (id, guild_id, amount, reason, member_id, actor_id, note)
  VALUES (v_id, p_guild_id, -p_amount, 'payout', p_member_id, v_caller, v_note);

  INSERT INTO audit_event (id, action, guild_id, occurred_at, actor_id, target_id, metadata)
  VALUES (gen_random_uuid(), 'treasury.payout', p_guild_id, now(), v_caller, p_member_id,
          jsonb_strip_nulls(jsonb_build_object('amount', p_amount, 'note', v_note, 'source', 'panel')));

  RETURN jsonb_build_object('balance', v_balance - p_amount, 'amount', p_amount);
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION panel_treasury(text) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION panel_find_members(text, text) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION panel_treasury_pay_out(text, text, bigint, text) FROM PUBLIC;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION panel_treasury(text) FROM anon;
    REVOKE ALL ON FUNCTION panel_find_members(text, text) FROM anon;
    REVOKE ALL ON FUNCTION panel_treasury_pay_out(text, text, bigint, text) FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION panel_treasury(text) TO authenticated;
    GRANT EXECUTE ON FUNCTION panel_find_members(text, text) TO authenticated;
    GRANT EXECUTE ON FUNCTION panel_treasury_pay_out(text, text, bigint, text) TO authenticated;
  END IF;
END;
$$;

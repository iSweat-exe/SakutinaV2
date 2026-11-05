CREATE TABLE IF NOT EXISTS economy_account (
  guild_id text NOT NULL,
  member_id text NOT NULL,
  wallet bigint NOT NULL DEFAULT 0,
  bank bigint NOT NULL DEFAULT 0,
  last_work_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (guild_id, member_id),
  CONSTRAINT economy_account_wallet_range CHECK (wallet >= 0 AND wallet <= 1000000000000),
  CONSTRAINT economy_account_bank_range CHECK (bank >= 0 AND bank <= 1000000000000)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS economy_ledger (
  seq bigint GENERATED ALWAYS AS IDENTITY,
  id uuid PRIMARY KEY,
  guild_id text NOT NULL,
  member_id text NOT NULL,
  kind text NOT NULL,
  amount bigint NOT NULL,
  wallet_after bigint NOT NULL,
  bank_after bigint NOT NULL,
  reason text NOT NULL,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL,
  CONSTRAINT economy_ledger_kind CHECK (kind IN ('earn', 'spend', 'deposit', 'withdraw')),
  CONSTRAINT economy_ledger_amount_positive CHECK (amount > 0),
  CONSTRAINT economy_ledger_balances_non_negative CHECK (wallet_after >= 0 AND bank_after >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS economy_ledger_idempotency_idx ON economy_ledger (guild_id, idempotency_key);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS economy_ledger_member_time_idx ON economy_ledger (guild_id, member_id, seq DESC);
--> statement-breakpoint
-- Grand livre immuable : aucune modification ni suppression de ligne, même par le bot.
CREATE OR REPLACE FUNCTION economy_ledger_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'economy_ledger is immutable';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER economy_ledger_no_change
BEFORE UPDATE OR DELETE ON economy_ledger
FOR EACH ROW EXECUTE FUNCTION economy_ledger_immutable();
--> statement-breakpoint
ALTER TABLE economy_account ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE economy_ledger ENABLE ROW LEVEL SECURITY;

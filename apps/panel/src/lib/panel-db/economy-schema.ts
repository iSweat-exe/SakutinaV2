/** Shape returned by `panel_economy`, and its validation (no I/O). */
export type Economy = Readonly<{
  coinsTotal: number;
  /** Members holding at least one coin. */
  holders: number;
  average: number;
  earned24h: number;
  spent24h: number;
  /** Coins in circulation at the end of each of the last 7 UTC days, oldest first (the last one is now). */
  circulation: ReadonlyArray<Readonly<{ day: string; coins: number }>>;
  /** Biggest balances (wallet + bank), biggest first. `name` and `avatar` are null until the bot has seen the member. */
  top: ReadonlyArray<Readonly<{ memberId: string; coins: number; name: string | null; avatar: string | null }>>;
  rules: EconomyRules;
  /** The server's own funds in the closed economy, and the money supply (launch grant + arrival grants). */
  pools: EconomyPools;
}>;

/** Closed economy: no coin is created except the launch grant and the grant of each new member. */
export type EconomyPools = Readonly<{ reserve: number; casino: number; jackpot: number; moneySupply: number }>;

/** The server's economy rules, as the bot applies them. */
export type EconomyRules = Readonly<{
  currencyName: string;
  /**
   * Daily salary budget, in tenths of a percent of the reserve (10 = 1% a day), shared between active members by
   * /economy work and /economy daily.
   */
  salaryBudgetPermille: number;
  /** Coins given to every new member. */
  startingBalance: number;
  /** Percentage kept by the server on every /economy pay (0 to 25). */
  transferTaxPercent: number;
  /** Daily interest on the bank, in tenths of a percent (0 = off, 50 = 5%). Paid out of the treasury, never created. */
  bankInterestPermille: number;
  /** Weekly wealth tax above the threshold, in tenths of a percent: active members, then idle accounts (14 days). */
  wealthTaxPermille: number;
  idleTaxPermille: number;
}>;

/** Limits enforced by the database; the form uses the same ones. */
export const RULE_LIMITS = {
  currencyName: { max: 24 },
  salaryBudgetPermille: { max: 100 },
  startingBalance: { max: 1_000_000 },
  transferTaxPercent: { max: 25 },
  bankInterestPermille: { max: 50 },
  wealthTaxPermille: { max: 50 },
  idleTaxPermille: { max: 100 },
} as const;

const isCount = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;

function parseCirculation(value: unknown): Economy["circulation"] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const points: { day: string; coins: number }[] = [];

  for (const item of value as unknown[]) {
    const p = item as Record<string, unknown> | null;

    if (!p || typeof p.day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(p.day) || !isCount(p.coins)) {
      return null;
    }

    points.push({ day: p.day, coins: p.coins });
  }

  return points;
}

function parseTop(value: unknown): Economy["top"] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const holders: { memberId: string; coins: number; name: string | null; avatar: string | null }[] = [];

  for (const item of value as unknown[]) {
    const h = item as Record<string, unknown> | null;

    if (!h || typeof h.member_id !== "string" || !/^\d{5,25}$/.test(h.member_id) || !isCount(h.coins)) {
      return null;
    }

    holders.push({
      memberId: h.member_id,
      coins: h.coins,
      name: typeof h.name === "string" && h.name.trim() ? h.name : null,
      avatar: typeof h.avatar === "string" && h.avatar ? h.avatar : null,
    });
  }

  return holders;
}

/** Validates the rules object returned by `panel_economy` and `panel_set_economy_rules`. */
export function parseRules(value: unknown): EconomyRules | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const v = value as Record<string, unknown>;

  if (
    typeof v.currency_name !== "string" ||
    !v.currency_name.trim() ||
    v.currency_name.length > RULE_LIMITS.currencyName.max ||
    !isCount(v.salary_budget_permille) ||
    v.salary_budget_permille > RULE_LIMITS.salaryBudgetPermille.max ||
    !isCount(v.wealth_tax_permille) ||
    v.wealth_tax_permille > RULE_LIMITS.wealthTaxPermille.max ||
    !isCount(v.idle_tax_permille) ||
    v.idle_tax_permille > RULE_LIMITS.idleTaxPermille.max ||
    !isCount(v.starting_balance) ||
    v.starting_balance > RULE_LIMITS.startingBalance.max ||
    !isCount(v.transfer_tax_percent) ||
    v.transfer_tax_percent > RULE_LIMITS.transferTaxPercent.max ||
    // A database from before the bank interest has no such field: that is "off", not an error.
    (v.bank_interest_permille !== undefined && (!isCount(v.bank_interest_permille) || v.bank_interest_permille > RULE_LIMITS.bankInterestPermille.max))
  ) {
    return null;
  }

  return {
    currencyName: v.currency_name,
    salaryBudgetPermille: v.salary_budget_permille,
    startingBalance: v.starting_balance,
    transferTaxPercent: v.transfer_tax_percent,
    bankInterestPermille: typeof v.bank_interest_permille === "number" ? v.bank_interest_permille : 0,
    wealthTaxPermille: v.wealth_tax_permille,
    idleTaxPermille: v.idle_tax_permille,
  };
}

/** Validates the JSON of `panel_economy`; `null` for anything that does not have the expected shape. */
export function parseEconomy(value: unknown): Economy | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const v = value as Record<string, unknown>;
  const circulation = parseCirculation(v.circulation);
  const top = parseTop(v.top);
  const rules = parseRules(v.rules);
  const pools = parsePools(v.pools);

  if (
    !pools ||
    !circulation ||
    !top ||
    !rules ||
    !isCount(v.coins_total) ||
    !isCount(v.holders) ||
    !isCount(v.average) ||
    !isCount(v.earned_24h) ||
    !isCount(v.spent_24h)
  ) {
    return null;
  }

  return {
    coinsTotal: v.coins_total,
    holders: v.holders,
    average: v.average,
    earned24h: v.earned_24h,
    spent24h: v.spent_24h,
    circulation,
    top,
    rules,
    pools,
  };
}

function parsePools(value: unknown): EconomyPools | null {
  const v = value as Record<string, unknown> | null;

  if (!v || !isCount(v.reserve) || !isCount(v.casino) || !isCount(v.jackpot) || !isCount(v.money_supply)) {
    return null;
  }

  return { reserve: v.reserve, casino: v.casino, jackpot: v.jackpot, moneySupply: v.money_supply };
}

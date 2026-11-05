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
  /** Biggest balances (wallet + bank), biggest first. */
  top: ReadonlyArray<Readonly<{ memberId: string; coins: number }>>;
}>;

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

  const holders: { memberId: string; coins: number }[] = [];

  for (const item of value as unknown[]) {
    const h = item as Record<string, unknown> | null;

    if (!h || typeof h.member_id !== "string" || !/^\d{5,25}$/.test(h.member_id) || !isCount(h.coins)) {
      return null;
    }

    holders.push({ memberId: h.member_id, coins: h.coins });
  }

  return holders;
}

/** Validates the JSON of `panel_economy`; `null` for anything that does not have the expected shape. */
export function parseEconomy(value: unknown): Economy | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const v = value as Record<string, unknown>;
  const circulation = parseCirculation(v.circulation);
  const top = parseTop(v.top);

  if (
    !circulation ||
    !top ||
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
  };
}

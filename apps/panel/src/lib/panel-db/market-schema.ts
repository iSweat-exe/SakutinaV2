/** Shape returned by `panel_market`, its validation and the candle gap filling (no I/O). */

export const PERIODS = ["15m", "1H", "1D", "1W"] as const;
export type Period = (typeof PERIODS)[number];

/** Length of one candle of each period, in milliseconds. */
export const PERIOD_MS: Readonly<Record<Period, number>> = {
  "15m": 15 * 60_000,
  "1H": 3_600_000,
  "1D": 86_400_000,
  "1W": 7 * 86_400_000,
};

/** The chart shows this many candles at most. */
export const CANDLE_COUNT = 80;

/** One candle of the Casino share price, in hundredths of a coin; `t` is its start (UTC). */
export type Candle = Readonly<{ t: number; o: number; h: number; l: number; c: number; v: number }>;

export type Holder = Readonly<{ memberId: string; shares: number; name: string | null; avatar: string | null }>;

export type Market = Readonly<{
  generatedAt: string;
  currencyName: string;
  period: Period;
  /** False until the server's casino account exists (the bot opens it on first use). */
  opened: boolean;
  /** Casino account: the share price is `fund / shares`. */
  fund: number;
  jackpot: number;
  shares: number;
  /** Shares the server still holds (for sale). */
  serverShares: number;
  /** What the casino won (positive) or lost since last Sunday. */
  weekNet: number;
  priceCents: number;
  holders: ReadonlyArray<Holder>;
  candles: ReadonlyArray<Candle>;
}>;

const isCount = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const isPeriod = (value: unknown): value is Period => typeof value === "string" && (PERIODS as readonly string[]).includes(value);

function parseCandles(value: unknown): Candle[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const candles: Candle[] = [];

  for (const item of value as unknown[]) {
    const c = item as Record<string, unknown> | null;
    const t = typeof c?.t === "string" ? Date.parse(c.t) : Number.NaN;

    if (!c || !Number.isFinite(t) || !isCount(c.o) || !isCount(c.h) || !isCount(c.l) || !isCount(c.c) || !isCount(c.v) || c.l > c.h) {
      return null;
    }

    candles.push({ t, o: c.o, h: c.h, l: c.l, c: c.c, v: c.v });
  }

  return candles.sort((a, b) => a.t - b.t);
}

function parseHolders(value: unknown): Holder[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const holders: Holder[] = [];

  for (const item of value as unknown[]) {
    const h = item as Record<string, unknown> | null;

    if (!h || typeof h.member_id !== "string" || !/^\d{5,25}$/.test(h.member_id) || !isCount(h.shares)) {
      return null;
    }

    holders.push({
      memberId: h.member_id,
      shares: h.shares,
      name: typeof h.name === "string" && h.name.trim() ? h.name : null,
      avatar: typeof h.avatar === "string" && h.avatar ? h.avatar : null,
    });
  }

  return holders;
}

/** Validates the JSON of `panel_market`; `null` for anything that does not have the expected shape. */
export function parseMarket(value: unknown): Market | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const v = value as Record<string, unknown>;
  const candles = parseCandles(v.candles);
  const holders = parseHolders(v.holders);

  if (
    !candles ||
    !holders ||
    typeof v.generated_at !== "string" ||
    typeof v.currency_name !== "string" ||
    !v.currency_name.trim() ||
    !isPeriod(v.period) ||
    typeof v.opened !== "boolean" ||
    !isCount(v.fund) ||
    !isCount(v.jackpot) ||
    !isCount(v.shares) ||
    v.shares === 0 ||
    !isCount(v.server_shares) ||
    v.server_shares > v.shares ||
    typeof v.week_net !== "number" ||
    !Number.isFinite(v.week_net) ||
    !isCount(v.price_cents)
  ) {
    return null;
  }

  return {
    generatedAt: v.generated_at,
    currencyName: v.currency_name,
    period: v.period,
    opened: v.opened,
    fund: v.fund,
    jackpot: v.jackpot,
    shares: v.shares,
    serverShares: v.server_shares,
    weekNet: v.week_net,
    priceCents: v.price_cents,
    holders,
    candles,
  };
}

/** Start (UTC) of the candle of `period` that contains `at`; weeks start on Monday, like the database. */
export function bucketStart(at: number, period: Period): number {
  if (period === "1W") {
    const day = Math.floor(at / PERIOD_MS["1D"]);
    // 1970-01-01 was a Thursday: (day + 3) % 7 is 0 on Mondays.
    return (day - ((day + 3) % 7)) * PERIOD_MS["1D"];
  }

  return Math.floor(at / PERIOD_MS[period]) * PERIOD_MS[period];
}

/**
 * The candles to draw: one per period, up to the one that contains `now`. A period without any move has no row in
 * the database; it is drawn flat at the previous close, with no volume. Keeps the last `CANDLE_COUNT`. With no candle
 * at all, a single flat candle at the current price.
 */
export function fillCandles(candles: ReadonlyArray<Candle>, period: Period, now: number, priceCents: number): Candle[] {
  const step = PERIOD_MS[period];
  const last = bucketStart(now, period);

  if (candles.length === 0) {
    return [{ t: last, o: priceCents, h: priceCents, l: priceCents, c: priceCents, v: 0 }];
  }

  const byStart = new Map(candles.map((candle) => [bucketStart(candle.t, period), candle]));
  const first = Math.max(bucketStart(candles[0]!.t, period), last - (CANDLE_COUNT - 1) * step);
  // The close just before the window opens, so a gap at its start continues the real price.
  let close = [...candles].reverse().find((candle) => bucketStart(candle.t, period) < first)?.c ?? candles[0]!.o;
  const filled: Candle[] = [];

  for (let t = first; t <= last; t += step) {
    const candle = byStart.get(t);

    if (candle) {
      filled.push({ ...candle, t });
      close = candle.c;
    } else {
      filled.push({ t, o: close, h: close, l: close, c: close, v: 0 });
    }
  }

  return filled.slice(-CANDLE_COUNT);
}

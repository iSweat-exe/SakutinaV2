/** Shape returned by `panel_treasury` and `panel_find_members`, and their validation (no I/O). */
export type TreasuryMovement = Readonly<{
  id: string;
  /** Signed: positive = into the treasury. */
  amount: number;
  /** `tax`, `casino:<game>:<outcome>` or `payout`. */
  reason: string;
  note: string | null;
  createdAt: string;
  memberId: string | null;
  memberName: string | null;
  memberAvatar: string | null;
}>;

export type Treasury = Readonly<{
  /** When the database computed this: the "now" of the relative times, so server and browser agree. */
  generatedAt: string;
  balance: number;
  in24h: number;
  out24h: number;
  /** Latest movements, newest first. */
  recent: ReadonlyArray<TreasuryMovement>;
}>;

export type MemberHit = Readonly<{ memberId: string; name: string; avatar: string | null }>;

/** Limits enforced by the database; the form uses the same ones. */
export const PAYOUT_LIMITS = { amountMax: 1_000_000_000_000, noteMax: 100 } as const;

const isCount = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const isMemberId = (value: unknown): value is string => typeof value === "string" && /^\d{5,25}$/.test(value);
const text = (value: unknown) => (typeof value === "string" && value.trim() ? value : null);

function parseMovements(value: unknown): Treasury["recent"] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const movements: TreasuryMovement[] = [];

  for (const item of value as unknown[]) {
    const m = item as Record<string, unknown> | null;

    if (
      !m ||
      typeof m.id !== "string" ||
      typeof m.amount !== "number" ||
      !Number.isFinite(m.amount) ||
      m.amount === 0 ||
      typeof m.reason !== "string" ||
      typeof m.created_at !== "string" ||
      Number.isNaN(Date.parse(m.created_at)) ||
      (m.member_id != null && !isMemberId(m.member_id))
    ) {
      return null;
    }

    movements.push({
      id: m.id,
      amount: m.amount,
      reason: m.reason,
      note: text(m.note),
      createdAt: m.created_at,
      memberId: typeof m.member_id === "string" ? m.member_id : null,
      memberName: text(m.member_name),
      memberAvatar: text(m.member_avatar),
    });
  }

  return movements;
}

/** Validates the JSON of `panel_treasury`; `null` for anything that does not have the expected shape. */
export function parseTreasury(value: unknown): Treasury | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const v = value as Record<string, unknown>;
  const recent = parseMovements(v.recent);

  if (
    !recent ||
    typeof v.generated_at !== "string" ||
    Number.isNaN(Date.parse(v.generated_at)) ||
    !isCount(v.balance) ||
    !isCount(v.in_24h) ||
    !isCount(v.out_24h)
  ) {
    return null;
  }

  return { generatedAt: v.generated_at, balance: v.balance, in24h: v.in_24h, out24h: v.out_24h, recent };
}

/** Validates the JSON of `panel_find_members`. */
export function parseMemberHits(value: unknown): MemberHit[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const hits: MemberHit[] = [];

  for (const item of value as unknown[]) {
    const h = item as Record<string, unknown> | null;

    if (!h || !isMemberId(h.member_id) || !text(h.name)) {
      return null;
    }

    hits.push({ memberId: h.member_id, name: h.name as string, avatar: text(h.avatar) });
  }

  return hits;
}

/** Validates the JSON of `panel_treasury_pay_out`: the treasury balance left. */
export function parsePayout(value: unknown): Readonly<{ balance: number; amount: number }> | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const v = value as Record<string, unknown>;

  return isCount(v.balance) && isCount(v.amount) ? { balance: v.balance, amount: v.amount } : null;
}

const GAMES: Record<string, string> = { slots: "Slots", blackjack: "Blackjack", roulette: "Roulette", coinflip: "Coinflip" };

/** What a movement is, in words: "Transfer tax", "Slots · lost bet", "Blackjack · prize paid", "Bank interest", "Pay out". */
export function describeMovement(reason: string): string {
  if (reason === "tax") {
    return "Transfer tax";
  }
  if (reason === "payout") {
    return "Pay out";
  }
  if (reason === "interest") {
    return "Bank interest";
  }

  const [, game, outcome] = reason.split(":");
  const name = (game && GAMES[game]) || "Casino";

  if (outcome === "loss" || outcome === "bet" || outcome === "double") {
    return `${name} · ${outcome === "loss" ? "lost bet" : "stake"}`;
  }

  return `${name} · prize paid`;
}

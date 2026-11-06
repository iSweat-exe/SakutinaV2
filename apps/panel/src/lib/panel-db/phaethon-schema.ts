/** Shape returned by `panel_phaethon`, and its validation (no I/O). */

/** Signals the database explains a score with (see migration 0019). Unknown ones are dropped, not guessed at. */
export const FLAGS = [
  "new-account",
  "young-account",
  "fresh-at-join",
  "identity-churn",
  "join-cluster",
  "same-avatar",
  "same-name",
  "after-ban",
  "sleepless",
  "burst",
  "automod",
  "mass-mentions",
  "scripted-claims",
  "big-transfers",
  "casino-luck",
  "warned",
  "sanctioned",
] as const;
export type Flag = (typeof FLAGS)[number];

export const RELATIONS = ["join", "avatar", "name", "after-ban"] as const;
export type Relation = (typeof RELATIONS)[number];

export type Review = "watch" | "dismissed";

export type LinkedAccount = Readonly<{
  memberId: string;
  name: string | null;
  relations: ReadonlyArray<Relation>;
  /** The linked account's own score; null when it is not on the server any more (a banned original). */
  score: number | null;
  /** The account banned just before this one joined. */
  banned: boolean;
}>;

export type Transfer = Readonly<{ memberId: string; name: string | null; direction: "in" | "out"; coins: number }>;

export type PhaethonEvent = Readonly<{
  at: string;
  /** "join", "identity", or an audit action ("automod.delete", "moderation.warn"…). */
  kind: string;
  change: string | null;
  rule: string | null;
  by: string | null;
}>;

export type WatchEntry = Readonly<{
  memberId: string;
  name: string | null;
  avatar: string | null;
  /** When the Discord account was created (read from its id). */
  createdAt: string | null;
  joinedAt: string | null;
  lastActiveAt: string | null;
  /** Points per factor, in the order of FACTORS (model.ts). */
  points: ReadonlyArray<number>;
  delta: number;
  confidence: number;
  flags: ReadonlyArray<Flag>;
  review: Review | null;
  /** Set while a ban asked from the panel waits for the bot, or when the bot could not do it. */
  banStatus: "pending" | "failed" | null;
  links: ReadonlyArray<LinkedAccount>;
  /** Messages per UTC hour over the last 7 days, oldest day first. */
  heat: ReadonlyArray<Readonly<{ day: string; hours: ReadonlyArray<number> }>>;
  /** Messages per hour over the last 72 hours, oldest first; the last one is the current hour. */
  rate: ReadonlyArray<number>;
  transfers: ReadonlyArray<Transfer>;
  casino: Readonly<{ won: number; played: number }>;
  events: ReadonlyArray<PhaethonEvent>;
}>;

export type Phaethon = Readonly<{
  generatedAt: string;
  membersTracked: number;
  banned7d: number;
  dismissed7d: number;
  /** Messages in an ordinary active hour of the server (median). */
  serverMedian: number;
  entries: ReadonlyArray<WatchEntry>;
}>;

/** Ban reasons: same limit as the database and the bot's /mod ban. */
export const BAN_REASON_MAX = 300;

type Raw = Record<string, unknown>;

const isCount = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const isInt = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value);
const isDate = (value: unknown): value is string => typeof value === "string" && !Number.isNaN(Date.parse(value));
const isId = (value: unknown): value is string => typeof value === "string" && /^\d{5,25}$/.test(value);
const isDay = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
const text = (value: unknown) => (typeof value === "string" && value.trim() ? value : null);
const date = (value: unknown) => (isDate(value) ? value : null);
const counts = (value: unknown, length: number) =>
  Array.isArray(value) && value.length === length && value.every(isCount) ? (value as number[]) : null;
const rows = (value: unknown) => (Array.isArray(value) ? (value as unknown[]) : null);
const known = <T extends string>(list: ReadonlyArray<T>, value: unknown): value is T => list.includes(value as T);

function parseLink(value: unknown): LinkedAccount | null {
  const v = value as Raw | null;

  if (!v || !isId(v.member_id) || !Array.isArray(v.relations) || (v.score !== null && !isCount(v.score))) {
    return null;
  }

  return {
    memberId: v.member_id,
    name: text(v.name),
    relations: v.relations.filter((r): r is Relation => known(RELATIONS, r)),
    score: v.score as number | null,
    banned: v.banned === true,
  };
}

function parseTransfer(value: unknown): Transfer | null {
  const v = value as Raw | null;

  return v && isId(v.member_id) && (v.direction === "in" || v.direction === "out") && isCount(v.coins)
    ? { memberId: v.member_id, name: text(v.name), direction: v.direction, coins: v.coins }
    : null;
}

function parseEvent(value: unknown): PhaethonEvent | null {
  const v = value as Raw | null;

  if (!v || !isDate(v.at) || typeof v.kind !== "string") {
    return null;
  }

  const detail = (typeof v.detail === "object" && v.detail !== null ? v.detail : {}) as Raw;

  return { at: v.at, kind: v.kind, change: text(detail.change), rule: text(detail.rule), by: text(detail.by) };
}

/** Every item must parse: a half-understood dossier is worse than none. */
function all<T>(value: unknown, parse: (item: unknown) => T | null): T[] | null {
  const list = rows(value);

  if (!list) {
    return null;
  }

  const parsed = list.map(parse);

  return parsed.every((item): item is T => item !== null) ? parsed : null;
}

function parseEntry(value: unknown): WatchEntry | null {
  const v = value as Raw | null;

  if (!v || !isId(v.member_id) || !isInt(v.delta) || !isCount(v.confidence) || !Array.isArray(v.flags)) {
    return null;
  }

  const points = counts(v.points, 6);
  const rate = counts(v.rate, 72);
  const heat = all(v.heat, (item) => {
    const day = item as Raw | null;
    const hours = day ? counts(day.hours, 24) : null;

    return day && isDay(day.day) && hours ? { day: day.day, hours } : null;
  });
  const links = all(v.links, parseLink);
  const transfers = all(v.transfers, parseTransfer);
  const events = all(v.events, parseEvent);
  const casino = v.casino as Raw | null;

  if (!points || !rate || !heat || heat.length !== 7 || !links || !transfers || !events || !casino || !isCount(casino.won) || !isCount(casino.played)) {
    return null;
  }

  return {
    memberId: v.member_id,
    name: text(v.name),
    avatar: text(v.avatar),
    createdAt: date(v.created_at),
    joinedAt: date(v.joined_at),
    lastActiveAt: date(v.last_active_at),
    points,
    delta: v.delta,
    confidence: Math.min(100, v.confidence),
    flags: v.flags.filter((flag): flag is Flag => known(FLAGS, flag)),
    review: v.review === "watch" || v.review === "dismissed" ? v.review : null,
    banStatus: v.ban_status === "pending" || v.ban_status === "failed" ? v.ban_status : null,
    links,
    heat,
    rate,
    transfers,
    casino: { won: casino.won, played: casino.played },
    events,
  };
}

export function parsePhaethon(value: unknown): Phaethon | null {
  const v = value as Raw | null;

  if (
    !v ||
    typeof v !== "object" ||
    !isDate(v.generated_at) ||
    !isCount(v.members_tracked) ||
    !isCount(v.banned_7d) ||
    !isCount(v.dismissed_7d) ||
    !isCount(v.server_median)
  ) {
    return null;
  }

  const entries = all(v.entries, parseEntry);

  return entries
    ? {
        generatedAt: v.generated_at,
        membersTracked: v.members_tracked,
        banned7d: v.banned_7d,
        dismissed7d: v.dismissed_7d,
        serverMedian: v.server_median,
        entries,
      }
    : null;
}

/** `{"status": …}` of `panel_set_phaethon_review`. */
export function parseReview(value: unknown): Review | "clear" | null {
  const status = (value as Raw | null)?.status;

  return status === "watch" || status === "dismissed" ? status : status === null ? "clear" : null;
}

/** `{"status": "pending"}` of `panel_request_ban`. */
export const parseBanRequest = (value: unknown): "pending" | null => ((value as Raw | null)?.status === "pending" ? "pending" : null);

/** The dashboard's summary (`panel_phaethon_top`): the highest scores, without their dossier. */
export type PhaethonTop = Readonly<{
  count: number;
  top: ReadonlyArray<Readonly<{ memberId: string; name: string | null; avatar: string | null; score: number; flags: ReadonlyArray<Flag> }>>;
}>;

export function parsePhaethonTop(value: unknown): PhaethonTop | null {
  const v = value as Raw | null;
  const top = v && isCount(v.count)
    ? all(v.top, (item) => {
        const t = item as Raw | null;

        return t && isId(t.member_id) && isCount(t.score) && Array.isArray(t.flags)
          ? {
              memberId: t.member_id,
              name: text(t.name),
              avatar: text(t.avatar),
              score: t.score,
              flags: t.flags.filter((flag): flag is Flag => known(FLAGS, flag)),
            }
          : null;
      })
    : null;

  return v && top ? { count: v.count as number, top } : null;
}

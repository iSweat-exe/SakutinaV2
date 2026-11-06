/**
 * Phaethon, from what the database reports to what the page draws. The score itself is computed by the database
 * (migration 0019); this file only puts words and shapes on it: tags, a verdict, the evidence timeline and charts.
 * Pure functions, no I/O: tested in model.test.ts.
 */
import { memberAvatarUrl } from "@/lib/discord-guilds";
import { dayShort, number } from "@/lib/format";
import type { Flag, LinkedAccount, Relation, WatchEntry } from "@/lib/panel-db/phaethon-schema";

/** Factors of the score and their maximum, in the order of `WatchEntry.points`. */
export const FACTORS = [
  ["Account integrity", 25],
  ["Coordination", 25],
  ["Automation", 20],
  ["Content abuse", 15],
  ["Economy abuse", 10],
  ["History", 5],
] as const;

export type Category = "Alt" | "Automation" | "Economy" | "Content";
export type Severity = "high" | "med" | "low" | "info";

export const CATEGORIES = ["All", "Alt", "Automation", "Economy", "Content"] as const;
export type Filter = (typeof CATEGORIES)[number];

export const SEVERITY_COLOR: Record<Severity, string> = {
  high: "#ff8a80",
  med: "#fbbf24",
  low: "#6aa7ff",
  info: "#a6a6ad",
};

export function band(score: number): { label: "High" | "Medium" | "Low"; color: string } {
  if (score >= 70) return { label: "High", color: "#ff8a80" };
  if (score >= 45) return { label: "Medium", color: "#fbbf24" };
  return { label: "Low", color: "#6aa7ff" };
}

/** Tag of each signal, most telling first: a row shows the first three. */
const TAGS: ReadonlyArray<readonly [Flag, string]> = [
  ["after-ban", "Ban evasion"],
  ["join-cluster", "Joined together"],
  ["sleepless", "No sleep gap"],
  ["scripted-claims", "Scripted claims"],
  ["casino-luck", "Casino luck"],
  ["same-avatar", "Same avatar"],
  ["same-name", "Look-alike name"],
  ["burst", "Message burst"],
  ["automod", "Auto-mod hits"],
  ["mass-mentions", "Mass mentions"],
  ["big-transfers", "Large transfers"],
  ["identity-churn", "Identity changes"],
  ["new-account", "New account"],
  ["fresh-at-join", "Created to join"],
  ["young-account", "Young account"],
  ["warned", "Warned"],
  ["sanctioned", "Sanctioned"],
];

/** Tags of a set of signals, most telling first. */
export const tagsOf = (flags: ReadonlyArray<Flag>) => TAGS.filter(([flag]) => flags.includes(flag)).map(([, label]) => label);

const CATEGORY_OF: Readonly<Partial<Record<Flag, ReadonlyArray<Category>>>> = {
  "join-cluster": ["Alt"],
  "same-avatar": ["Alt"],
  "same-name": ["Alt"],
  "after-ban": ["Alt"],
  sleepless: ["Automation"],
  burst: ["Automation"],
  "scripted-claims": ["Automation", "Economy"],
  "big-transfers": ["Economy"],
  "casino-luck": ["Economy"],
  automod: ["Content"],
  "mass-mentions": ["Content"],
};

export const RELATION_LABEL: Readonly<Record<Relation, string>> = {
  "after-ban": "Banned before it joined",
  join: "Same join minute",
  avatar: "Same avatar",
  name: "Look-alike name",
};

const IDENTITY_LABEL: Readonly<Record<string, string>> = {
  nickname: "nickname",
  username: "username",
  "display-name": "display name",
  avatar: "avatar",
};

const RULE_LABEL: Readonly<Record<string, string>> = {
  spam: "spam filter",
  links: "link filter",
  words: "banned-word filter",
  mentions: "mention limit",
};

const MODERATION: Readonly<Record<string, readonly [verb: string, severity: Severity]>> = {
  "moderation.warn": ["Warned", "info"],
  "moderation.unwarn": ["Warning removed", "info"],
  "moderation.timeout": ["Muted", "med"],
  "moderation.untimeout": ["Unmuted", "info"],
  "moderation.kick": ["Kicked", "high"],
  "moderation.ban": ["Banned", "high"],
  "moderation.unban": ["Unbanned", "info"],
};

export type Evidence = readonly [time: string, kind: string, severity: Severity, text: string];

/** A watchlist account, ready to show. */
export type Entity = Readonly<{
  id: string;
  name: string;
  avatarUrl: string | null;
  /** The Discord id, grouped by four digits for reading. */
  uid: string;
  created: string;
  joined: string;
  status: string;
  tags: ReadonlyArray<string>;
  cats: ReadonlyArray<Category>;
  pts: ReadonlyArray<number>;
  score: number;
  delta: number;
  conf: number;
  verdict: string;
  heatNote: string;
  rateNote: string;
  review: WatchEntry["review"];
  banStatus: WatchEntry["banStatus"];
  /** Suggested ban reason: what the panel writes in the audit log when you confirm. */
  banReason: string;
  links: ReadonlyArray<LinkedAccount>;
  eco: Readonly<{
    transfers: ReadonlyArray<readonly [who: string, direction: "in" | "out", coins: number]>;
    casino: readonly [won: number, total: number] | null;
  }> | null;
  events: ReadonlyArray<Evidence>;
  heat: WatchEntry["heat"];
  rate: WatchEntry["rate"];
}>;

const DAY_MS = 86_400_000;

/** "Member …4457" until the bot has seen the member's name. */
export const memberName = (id: string, name: string | null) => name ?? `Member …${id.slice(-4)}`;

/** "today", "3 days ago", "8 months ago", "2 years ago". */
export function ago(iso: string | null, now: number): string {
  if (!iso) return "unknown";
  const days = Math.floor((now - Date.parse(iso)) / DAY_MS);

  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 60) return `${days} days ago`;
  if (days < 730) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

const hhmm = (date: Date) => `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;

/** "Today 03:12", "Yesterday 22:10", "Mon 12:00", "Oct 2": UTC, like the rest of the panel. */
export function when(iso: string, now: number): string {
  const at = new Date(iso);
  const days = Math.floor(now / DAY_MS) - Math.floor(at.getTime() / DAY_MS);

  if (days <= 0) return `Today ${hhmm(at)}`;
  if (days === 1) return `Yesterday ${hhmm(at)}`;
  if (days < 7) return `${at.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })} ${hhmm(at)}`;
  return at.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

const plural = (n: number, word: string) => `${number(n)} ${word}${n === 1 ? "" : "s"}`;
const busiestDayHours = (entry: WatchEntry) => Math.max(0, ...entry.heat.map((day) => day.hours.filter((v) => v > 0).length));
const peakHour = (entry: WatchEntry) => Math.max(0, ...entry.heat.flatMap((day) => day.hours));

function evidence(entry: WatchEntry, now: number): Evidence[] {
  const created = entry.createdAt ? Date.parse(entry.createdAt) : null;

  return entry.events.flatMap((event): Evidence[] => {
    const time = when(event.at, now);

    if (event.kind === "join") {
      const fresh = created !== null && Date.parse(event.at) - created < DAY_MS;
      return [[time, "JOIN", fresh ? "high" : "low", fresh ? "Joined with an account created that same day" : "Joined the server"]];
    }

    if (event.kind === "identity") {
      return [[time, "ID", "low", `Changed ${IDENTITY_LABEL[event.change ?? ""] ?? "profile"}`]];
    }

    if (event.kind.startsWith("automod.")) {
      const rule = RULE_LABEL[event.rule ?? ""] ?? "auto-moderation";
      return [[time, "AUTO", event.kind === "automod.timeout" ? "high" : "med", event.kind === "automod.timeout" ? `Muted by the ${rule}` : `Message removed by the ${rule}`]];
    }

    const moderation = MODERATION[event.kind];
    return moderation ? [[time, "MOD", moderation[1], event.by ? `${moderation[0]} by ${event.by}` : moderation[0]]] : [];
  });
}

/** Two or three plain sentences that say why the account is on the list. */
export function verdictOf(entry: WatchEntry, now: number): string {
  const has = (flag: Flag) => entry.flags.includes(flag);
  const relation = (r: Relation) => entry.links.filter((link) => link.relations.includes(r)).length;
  const sentences: string[] = [];

  if (has("after-ban")) {
    sentences.push("Joined within an hour of a ban, with an account less than a month old: possibly the banned member coming back.");
  }
  if (has("join-cluster")) {
    sentences.push(`Joined within two minutes of ${plural(relation("join"), "other account")}.`);
  }
  if (has("same-avatar") || has("same-name")) {
    sentences.push(`Shares its avatar or name with ${plural(relation("avatar") + relation("name"), "account")}.`);
  }
  if (has("new-account") || has("young-account")) {
    sentences.push(`The Discord account was created ${ago(entry.createdAt, now)}${has("fresh-at-join") ? ", just before it joined" : ""}.`);
  }
  if (has("sleepless")) {
    sentences.push(`Wrote in ${busiestDayHours(entry)} different hours of a single day, with no sleep gap.`);
  }
  if (has("burst")) {
    sentences.push(`Sent ${plural(peakHour(entry), "message")} in a single hour.`);
  }
  if (has("automod")) {
    sentences.push("The auto-moderation had to step in.");
  }
  if (has("mass-mentions")) {
    sentences.push("Mentioned 50 or more members in a single day.");
  }
  if (has("scripted-claims")) {
    sentences.push("Claims the daily reward at the same time every day, to the minute.");
  }
  if (has("casino-luck")) {
    sentences.push(`Won ${entry.casino.won} of ${entry.casino.played} casino games, far beyond chance.`);
  }
  if (has("big-transfers")) {
    sentences.push(`Moved ${number(entry.transfers.reduce((sum, t) => sum + t.coins, 0))} coins in transfers this month.`);
  }
  if (has("identity-churn")) {
    sentences.push("Changed its name or avatar several times this week.");
  }
  if (has("warned") || has("sanctioned")) {
    sentences.push("Has been warned or sanctioned before.");
  }

  return sentences.length > 0 ? sentences.slice(0, 3).join(" ") : "No strong signal right now. It stays on the list because you are watching it.";
}

/** The page's view of one watchlist entry. `now` is the snapshot time, so server and browser agree. */
export function toEntity(entry: WatchEntry, now: number): Entity {
  const score = entry.points.reduce((a, b) => a + b, 0);
  const tags = tagsOf(entry.flags);
  const cats = [...new Set(entry.flags.flatMap((flag) => CATEGORY_OF[flag] ?? []))];
  const peak = Math.max(0, ...entry.rate);
  const busiest = busiestDayHours(entry);
  const name = memberName(entry.memberId, entry.name);

  return {
    id: entry.memberId,
    name,
    avatarUrl: memberAvatarUrl(entry.memberId, entry.avatar),
    uid: entry.memberId.replace(/(\d{4})(?=\d)/g, "$1 "),
    created: ago(entry.createdAt, now),
    joined: entry.joinedAt ? when(entry.joinedAt, now).replace(/^Today/, "today,").replace(/^Yesterday/, "yesterday,") : "unknown",
    status: entry.lastActiveAt ? `Last active ${when(entry.lastActiveAt, now).replace(/^(Today|Yesterday)/, (word) => word.toLowerCase())}` : "Never active",
    tags: tags.slice(0, 3),
    cats,
    pts: entry.points,
    score,
    delta: entry.delta,
    conf: entry.confidence,
    verdict: verdictOf(entry, now),
    heatNote: busiest >= 16 ? `Active in ${busiest} of 24 hours on its busiest day (UTC)` : "Messages per hour over the last 7 days (UTC)",
    rateNote: peak > 0 ? `Peak of ${plural(peak, "message")} in one hour` : "No message in the last 72 hours",
    review: entry.review,
    banStatus: entry.banStatus,
    banReason: `Phaethon: ${tags.slice(0, 3).join(", ") || "flagged account"}`,
    links: entry.links,
    eco:
      entry.transfers.length > 0 || entry.casino.played > 0
        ? {
            transfers: entry.transfers.map((t) => [memberName(t.memberId, t.name), t.direction, t.coins] as const),
            casino: entry.casino.played > 0 ? [entry.casino.won, entry.casino.played] : null,
          }
        : null,
    events: evidence(entry, now),
    heat: entry.heat,
    rate: entry.rate,
  };
}

// ---- charts -----------------------------------------------------------------

export type Heat = Readonly<{ labels: ReadonlyArray<string>; cells: ReadonlyArray<{ x: number; y: number; o: string; title: string }> }>;

export type RateSeries = Readonly<{
  grid: ReadonlyArray<{ y: string; ty: string; label: string }>;
  medianY: string;
  line: string;
  area: string;
  spikes: ReadonlyArray<{ x: string; y: string }>;
  ticks: ReadonlyArray<{ x: string; label: string }>;
}>;

export type GraphNode = Readonly<{
  id: string; name: string; score: string; relation: string; x: string; y: string; ty: string; ly: string; ry: string; color: string; width: string;
}>;

export type Dossier = Readonly<{
  heat: Heat | null;
  rate: RateSeries | null;
  nodes: ReadonlyArray<GraphNode>;
}>;

/** Draws the charts of one account. A chart without a single message is left out. */
export function drawDossier(entity: Entity, serverMedian: number): Dossier {
  let heat: Heat | null = null;
  const max = Math.max(0, ...entity.heat.flatMap((day) => day.hours));

  if (max > 0) {
    heat = {
      labels: entity.heat.map((day) => dayShort(day.day)),
      cells: entity.heat.flatMap((day, d) =>
        day.hours.map((value, h) => ({
          x: 40 + h * 25,
          y: 4 + d * 22,
          o: (0.07 + 0.93 * (value / max)).toFixed(2),
          title: `${dayShort(day.day)} ${String(h).padStart(2, "0")}:00 UTC: ${plural(value, "message")}`,
        })),
      ),
    };
  }

  let series: RateSeries | null = null;
  const values = entity.rate;
  const points = values.length;

  if (points > 1 && values.some((v) => v > 0)) {
    const vmax = Math.max(10, Math.ceil(Math.max(...values, serverMedian) / 10) * 10);
    const cx = (t: number) => 40 + t * (700 / (points - 1));
    const cy = (v: number) => 148 - (v / vmax) * 130;
    const line = values.map((v, i) => `${i ? "L" : "M"}${cx(i).toFixed(1)} ${cy(v).toFixed(1)}`).join(" ");
    series = {
      grid: [0, vmax / 2, vmax].map((v) => ({ y: cy(v).toFixed(1), ty: (cy(v) + 4).toFixed(1), label: String(v) })),
      medianY: cy(serverMedian).toFixed(1),
      line,
      area: `${line} L740 148 L40 148 Z`,
      spikes: values.flatMap((v, i) => (v > 0 && v > serverMedian * 3 ? [{ x: cx(i).toFixed(1), y: cy(v).toFixed(1) }] : [])),
      ticks: [0, 24, 48, points - 1].map((t) => ({ x: cx(t).toFixed(1), label: t === points - 1 ? "Now" : `-${points - 1 - t} h` })),
    };
  }

  const links = entity.links;
  const nodes = links.map((link, i): GraphNode => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / links.length;
    const x = 200 + 130 * Math.cos(angle);
    const y = 120 + 74 * Math.sin(angle);
    const strength = link.banned ? 100 : (link.score ?? 0);

    return {
      id: link.memberId,
      name: memberName(link.memberId, link.name),
      relation: RELATION_LABEL[link.relations[0] ?? "join"],
      score: link.banned ? "BAN" : link.score === null ? "–" : String(link.score),
      x: x.toFixed(1), y: y.toFixed(1), ty: (y + 4.5).toFixed(1), ly: (y + 34).toFixed(1), ry: (y + 46).toFixed(1),
      color: band(strength).color,
      width: (1.2 + (Math.min(strength, 100) / 100) * 2.4).toFixed(1),
    };
  });

  return { heat, rate: series, nodes };
}

/**
 * Sample Phaethon intelligence (locked): the shape the real API should fill.
 * Everything below `ENTITIES` is derived deterministically from an entity, so
 * the same account always draws the same rhythm and charts.
 */

export const FACTORS = [
  ["Account integrity", 25],
  ["Coordination", 25],
  ["Automation", 20],
  ["Content abuse", 15],
  ["Economy abuse", 10],
  ["History", 5],
] as const;

export type Category = "Alt" | "Automation" | "Economy" | "Content";
export type Module = "links" | "rate" | "heat" | "eco";
export type Profile = "burst" | "bot" | "night" | "farm" | "human";
export type Severity = "high" | "med" | "low" | "info";

export type Entity = Readonly<{
  id: number;
  name: string;
  uid: string;
  created: string;
  joined: string;
  status: string;
  tags: ReadonlyArray<string>;
  cats: ReadonlyArray<Category>;
  profile: Profile;
  /** Points per factor, same order as FACTORS. */
  pts: ReadonlyArray<number>;
  delta: number;
  conf: number;
  /** Which dossier panels apply to this account. */
  mods: ReadonlyArray<Module>;
  verdict: string;
  heatNote?: string;
  rateNote?: string;
  links?: ReadonlyArray<readonly [name: string, score: number, relation: string]>;
  eco?: Readonly<{
    transfers: ReadonlyArray<readonly [who: string, direction: "in" | "out", coins: number]>;
    casino?: readonly [won: number, total: number];
  }>;
  events: ReadonlyArray<readonly [time: string, kind: string, severity: Severity, text: string]>;
}>;

export const ENTITIES: ReadonlyArray<Entity> = [
  {
    id: 1, name: "shadow.fox_88", uid: "1082 4471 9933 2210", created: "2 days ago", joined: "today, 03:12", status: "Online",
    tags: ["Alt cluster", "Raid"], cats: ["Alt"], profile: "burst", pts: [24, 25, 17, 13, 8, 5], delta: 14, conf: 96, mods: ["links", "rate"],
    verdict: "Part of a 7-account cluster created from the same source. Joined together, posted the same message, then went silent.",
    rateNote: "Silent until 03:00, then a single spike of 40 messages in two minutes",
    links: [["fox.shade_12", 88, "Same join minute"], ["shadow_fx88", 85, "Same avatar"], ["foxx_shadow", 79, "Same invite"], ["sh4dow.fox", 74, "Same avatar"], ["fox_88b", 71, "Same join minute"], ["hollow.fox", 66, "Same invite"]],
    events: [["03:12", "JOIN", "high", "Joined with invite xK9-2f"], ["03:20", "MSG", "med", "Posted the same introduction in #general"], ["03:44", "AUTO", "info", "Muted by Sakutina (spam filter)"]],
  },
  {
    id: 2, name: "nova_trade", uid: "0933 1187 4502 7731", created: "5 days ago", joined: "5 days ago", status: "Online",
    tags: ["Spam bot", "Link farm"], cats: ["Automation", "Content"], profile: "bot", pts: [21, 10, 20, 15, 10, 5], delta: 9, conf: 91, mods: ["heat", "rate", "links"],
    verdict: "Posts on a fixed schedule around the clock. The cadence is too regular for a person and every message carries the same link.",
    heatNote: "No sleep gap across 7 days",
    rateNote: "Flat at about 28 per hour, one message every two minutes",
    links: [["nova_trade2", 83, "Same link domain"], ["tradebot_x", 61, "Coin transfers"]],
    events: [["Yesterday 22:10", "MSG", "high", "Same link posted 9 times in 10 minutes"], ["Yesterday 22:14", "ECON", "med", "Offered coins for invites in 3 channels"], ["Today 04:05", "MOD", "info", "Warned by Aiko"]],
  },
  {
    id: 3, name: "kaito.alt2", uid: "0771 5520 8841 0094", created: "9 days ago", joined: "2 days ago", status: "Offline",
    tags: ["Ban evasion"], cats: ["Alt"], profile: "night", pts: [24, 20, 9, 9, 10, 5], delta: 6, conf: 88, mods: ["links", "heat", "eco"],
    verdict: "Very likely the same person as a banned member. Joined minutes after the ban, with matching invite, locale and writing style.",
    heatNote: "Active between midnight and 05:00, like the banned account",
    links: [["kaito", 100, "Banned original"], ["kai.to_", 52, "Same invite"]],
    eco: { transfers: [["Account linked to kaito", "in", 12000]] },
    events: [["2 days ago", "MOD", "info", "kaito was banned for harassment"], ["2 days ago", "JOIN", "high", "Joined 3 minutes later, same invite and device locale"], ["Today 01:20", "MSG", "med", "Writing style 91% similar to kaito"]],
  },
  {
    id: 4, name: "pixel_ren", uid: "0412 9034 6615 3382", created: "41 days ago", joined: "38 days ago", status: "Online",
    tags: ["Coin farming"], cats: ["Economy", "Automation"], profile: "farm", pts: [14, 12, 18, 5, 10, 4], delta: 11, conf: 84, mods: ["heat", "eco"],
    verdict: "Farms the economy with scripted claims and funnels coins to other accounts. Casino results are far outside what chance allows.",
    heatNote: "Spikes every four hours on the hour, otherwise idle",
    eco: { transfers: [["ren_alt", "out", 4800], ["coin.hub", "out", 6200]], casino: [31, 33] },
    events: [["Monday", "ECON", "med", "Daily reward claimed 3 s after reset, 9 days running"], ["Today 12:00", "AUTO", "info", "Claim-timing rule triggered"]],
  },
  {
    id: 5, name: "echo.vale", uid: "0288 6710 1190 4457", created: "210 days ago", joined: "190 days ago", status: "Online",
    tags: ["Mass mentions"], cats: ["Content"], profile: "human", pts: [12, 6, 8, 15, 4, 1], delta: -3, conf: 62, mods: [],
    verdict: "A long-standing member with a normal rhythm. One incident of mass mentions, no sign of automation or links to other accounts.",
    events: [["Yesterday", "MOD", "info", "Warned for insulting a member"], ["Today 14:02", "MSG", "med", "Mentioned 12 members in one message, removed by the mention limit"]],
  },
  {
    id: 6, name: "lumen_77", uid: "0150 4476 3321 9908", created: "today", joined: "today, 10:00", status: "Online",
    tags: ["New account"], cats: [], profile: "human", pts: [14, 3, 8, 5, 2, 2], delta: 0, conf: 55, mods: [],
    verdict: "Brand new account that is simply busy. Nothing links it to other accounts. Keep an eye on it for a day.",
    events: [["Today 10:00", "JOIN", "low", "Account created today and joined by invite"], ["Today 10:05", "MSG", "low", "25 messages in the first 10 minutes"]],
  },
];

export const CATEGORIES = ["All", "Alt", "Automation", "Economy", "Content"] as const;
export type Filter = (typeof CATEGORIES)[number];

export const SEVERITY_COLOR: Record<Severity, string> = {
  high: "#ff8a80",
  med: "#fbbf24",
  low: "#6aa7ff",
  info: "#a6a6ad",
};

export const total = (entity: Entity) => entity.pts.reduce((a, b) => a + b, 0);

export function band(score: number): { label: "High" | "Medium" | "Low"; color: string } {
  if (score >= 70) return { label: "High", color: "#ff8a80" };
  if (score >= 45) return { label: "Medium", color: "#fbbf24" };
  return { label: "Low", color: "#6aa7ff" };
}

// ---- deterministic charts -------------------------------------------------

const rng = (seed: number) => {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const gauss = (x: number, c: number, w: number) => Math.exp(-Math.pow(x - c, 2) / w);
const circ = (h: number, c: number) => Math.min(Math.abs(h - c), 24 - Math.abs(h - c));

function intensity(profile: Profile, day: number, hour: number, r: number): number {
  switch (profile) {
    case "bot": return 0.55 + 0.25 * r;
    case "human": return Math.min(1, (0.08 + 0.85 * gauss(hour, 21, 18) + 0.3 * gauss(hour, 13, 20)) * (0.6 + 0.5 * r));
    case "night": return Math.min(1, 0.05 + 0.9 * gauss(circ(hour, 3), 0, 9) * (0.7 + 0.4 * r));
    case "farm": return hour % 4 === 0 ? 0.8 + 0.2 * r : 0.12 * r;
    case "burst": return day === 6 ? (hour >= 2 && hour <= 4 ? 0.7 + 0.3 * r : 0.04) : day === 5 ? 0.04 * r : 0;
  }
}

function rate(profile: Profile, t: number, r: number): number {
  const hourOfDay = (t + 5) % 24;
  switch (profile) {
    case "bot": return 28 + 5 * r;
    case "human": return 2 + 17 * gauss(hourOfDay, 21, 18) * (0.6 + 0.5 * r);
    case "night": return 1 + 24 * gauss(circ(hourOfDay, 3), 0, 9) * (0.7 + 0.4 * r);
    case "farm": return hourOfDay % 4 === 0 ? 30 + 6 * r : 1.5 * r;
    case "burst": return t >= 64 && t <= 68 ? 38 - Math.abs(t - 66) * 8 + 4 * r : 0.8 * r;
  }
}

export const DAY_LABELS = ["Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Wed"] as const;
const MEDIAN = 6;
const POINTS = 72;

export type Heat = Readonly<{ cells: ReadonlyArray<{ x: number; y: number; o: string }> }>;

export type RateSeries = Readonly<{
  grid: ReadonlyArray<{ y: string; ty: string; label: string }>;
  medianY: string;
  line: string;
  area: string;
  spikes: ReadonlyArray<{ x: string; y: string }>;
  ticks: ReadonlyArray<{ x: string; label: string }>;
}>;

export type GraphNode = Readonly<{
  name: string; score: string; relation: string; x: string; y: string; ty: string; ly: string; ry: string; color: string; width: string;
}>;

export type Dossier = Readonly<{
  heat: Heat | null;
  rate: RateSeries | null;
  nodes: ReadonlyArray<GraphNode>;
}>;

/** Draws the charts of one account. The order of rng() calls is part of the design. */
export function drawDossier(entity: Entity): Dossier {
  const r = rng(entity.id * 97 + 11);
  const has = (m: Module) => entity.mods.includes(m);

  let heat: Heat | null = null;
  if (has("heat")) {
    const cells: Array<{ x: number; y: number; o: string }> = [];
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        const value = Math.max(0, Math.min(1, intensity(entity.profile, d, h, r())));
        cells.push({ x: 40 + h * 25, y: 4 + d * 22, o: (0.07 + 0.93 * value).toFixed(2) });
      }
    }
    heat = { cells };
  }

  let series: RateSeries | null = null;
  if (has("rate")) {
    const values = Array.from({ length: POINTS }, (_, t) => rate(entity.profile, t, r()));
    const vmax = Math.max(40, Math.ceil(Math.max(...values, 0) / 10) * 10);
    const cx = (t: number) => 40 + t * (700 / (POINTS - 1));
    const cy = (v: number) => 148 - (v / vmax) * 130;
    const line = values.map((v, i) => `${i ? "L" : "M"}${cx(i).toFixed(1)} ${cy(v).toFixed(1)}`).join(" ");
    series = {
      grid: [0, vmax / 2, vmax].map((v) => ({ y: cy(v).toFixed(1), ty: (cy(v) + 4).toFixed(1), label: String(v) })),
      medianY: cy(MEDIAN).toFixed(1),
      line,
      area: `${line} L740 148 L40 148 Z`,
      spikes: values.flatMap((v, i) => (v > MEDIAN * 3 && i % 2 === 0 ? [{ x: cx(i).toFixed(1), y: cy(v).toFixed(1) }] : [])),
      ticks: [0, 24, 48, 71].map((t) => ({ x: cx(t).toFixed(1), label: t === 71 ? "Now" : `-${71 - t} h` })),
    };
  }

  const links = has("links") ? (entity.links ?? []) : [];
  const nodes = links.map(([name, score, relation], i): GraphNode => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / links.length;
    const x = 200 + 130 * Math.cos(angle);
    const y = 120 + 74 * Math.sin(angle);
    return {
      name, relation, score: score >= 100 ? "100" : String(score),
      x: x.toFixed(1), y: y.toFixed(1), ty: (y + 4.5).toFixed(1), ly: (y + 34).toFixed(1), ry: (y + 46).toFixed(1),
      color: band(score).color, width: (1.2 + (score / 100) * 2.4).toFixed(1),
    };
  });

  return { heat, rate: series, nodes };
}

/**
 * Demonstration data of the landing page and the geometry of its charts. Nothing
 * here comes from a real server: the numbers only show what each module looks like.
 * Everything is deterministic, so the server and the browser render the same markup.
 */
import type { ModuleKey } from "./copy";

/** 24×24 stroke icons of the modules. */
export const MODULE_ICONS: Record<ModuleKey, string> = {
  "Anti-Raid": "M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z",
  Moderation: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM5.6 5.6l12.8 12.8",
  Phaethon: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  Balance:
    "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM14.5 9.5c-.4-.9-1.4-1.5-2.5-1.5-1.4 0-2.5.8-2.5 2s1.1 1.6 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1.1 0-2.1-.6-2.5-1.5",
  Casino:
    "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01",
  Profiling: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-7 8-7s8 3 8 7",
  Modules: "M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12 4 7.5",
  Dashboard: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
};

export type OrbitChip = { key: ModuleKey; x: string; y: string };

/** Chips around the mascot, in percent of the box (centre at 50 / 50). */
function place(keys: ModuleKey[], radius: number, start: number): OrbitChip[] {
  return keys.map((key, i) => {
    const a = start + (2 * Math.PI * i) / keys.length;
    return { key, x: (50 + radius * Math.cos(a)).toFixed(2), y: (50 + radius * Math.sin(a)).toFixed(2) };
  });
}

export const ORBIT_INNER = place(["Anti-Raid", "Moderation", "Phaethon"], 30, -Math.PI / 2);
export const ORBIT_OUTER = place(["Balance", "Casino", "Profiling", "Modules"], 47, -Math.PI / 4);

/* ---------- Raid chart: joins per minute from 03:00 to 03:47 ---------- */

const joins = Array.from({ length: 48 }, (_, i) => {
  let v = 2 + Math.sin(i * 1.7) * 1.1 + Math.cos(i * 0.6) * 0.8;
  if (i >= 29 && i <= 35) v = [9, 22, 38, 34, 26, 11, 4][i - 29];
  if (i > 35) v = 1.4 + Math.sin(i) * 0.5;
  return Math.max(0.6, v);
});
const RX = (i: number) => 40 + i * (750 / 47);
const RY = (v: number) => 220 - (v / 40) * 190;
const raidLine = joins.map((v, i) => `${i ? "L" : "M"}${RX(i).toFixed(1)} ${RY(v).toFixed(1)}`).join(" ");

export const RAID = {
  line: raidLine,
  area: `${raidLine} L790 220 L40 220 Z`,
  bandX: RX(28.5).toFixed(1),
  bandW: (RX(35.5) - RX(28.5)).toFixed(1),
  bandCx: ((RX(28.5) + RX(35.5)) / 2).toFixed(1),
  lockX: RX(31).toFixed(1),
  lockTagX: (RX(31) + 8).toFixed(1),
  lockTagCx: (RX(31) + 60).toFixed(1),
  grid: [0, 20, 40].map((v) => ({ y: RY(v).toFixed(1), ty: (RY(v) + 4).toFixed(1), label: String(v) })),
  ticks: [0, 15, 30, 45].map((i) => ({ x: RX(i).toFixed(1), label: `03:${String(i).padStart(2, "0")}` })),
};

/* ---------- Phaethon: one suspicious member ---------- */

/** Points and maximum of each factor, in the order of FACTOR_NAMES. */
export const FACTORS: readonly (readonly [number, number])[] = [
  [24, 25],
  [25, 25],
  [17, 20],
  [13, 15],
  [8, 10],
  [5, 5],
];

const band = (score: number) => (score >= 70 ? "#ff8a80" : score >= 45 ? "#fbbf24" : "#6aa7ff");

const LINKS: readonly (readonly [string, number])[] = [
  ["fox.shade_12", 88],
  ["shadow_fx88", 85],
  ["foxx_shadow", 79],
  ["sh4dow.fox", 74],
  ["fox_88b", 71],
  ["hollow.fox", 66],
];

/** Length of the gauge arc (half a circle of radius 90). */
export const GAUGE_LENGTH = 282.7;
export const RISK_SCORE = 92;

export const LINKED_NODES = LINKS.map(([name, score], i) => {
  const a0 = 25 + i * 4;
  const angle = -Math.PI / 2 + (2 * Math.PI * i) / LINKS.length;
  const x = 200 + 140 * Math.cos(angle);
  const y = 128 + 84 * Math.sin(angle);
  return {
    name,
    score,
    i,
    a: a0,
    b: a0 + 20,
    color: band(score),
    x: x.toFixed(1),
    y: y.toFixed(1),
    ty: (y + 4.5).toFixed(1),
    ly: (y + 33).toFixed(1),
    w: (1 + score / 40).toFixed(1),
  };
});

/* ---------- Market: 40 hourly candles ---------- */

function rng(seed: number) {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = rng(7);
const candles: { o: number; h: number; l: number; c: number }[] = [];
for (let i = 0, price = 48; i < 40; i++) {
  const o = price;
  const c = o * (1 + (rand() - 0.47 + Math.sin(i / 7) * 0.12) * 0.035);
  const h = Math.max(o, c) * (1 + rand() * 0.01);
  const l = Math.min(o, c) * (1 - rand() * 0.01);
  candles.push({ o, h, l, c });
  price = c;
}
const pad = (Math.max(...candles.map((x) => x.h)) - Math.min(...candles.map((x) => x.l))) * 0.1;
const lo = Math.min(...candles.map((x) => x.l)) - pad;
const hi = Math.max(...candles.map((x) => x.h)) + pad;
const MY = (v: number) => 240 - ((v - lo) / (hi - lo)) * 225;
const step = 730 / 40;
const bodyW = step * 0.6;
const MX = (i: number) => 10 + step * (i + 0.5);
const movingAverage = candles.map((_, i) =>
  i < 7 ? null : candles.slice(i - 7, i + 1).reduce((sum, x) => sum + x.c, 0) / 8,
);
const lastClose = candles[39].c;
const change = ((lastClose - candles[38].c) / candles[38].c) * 100;

export const MARKET = {
  last: lastClose,
  whole: Math.floor(lastClose),
  frac: Math.round((lastClose - Math.floor(lastClose)) * 100) % 100,
  change: `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`,
  up: change >= 0,
  grid: [0.2, 0.5, 0.8].map((f) => {
    const v = lo + (hi - lo) * f;
    return { y: MY(v).toFixed(1), ty: (MY(v) + 4).toFixed(1), label: v.toFixed(2) };
  }),
  ma: movingAverage
    .map((v, i) => (v === null ? "" : `${movingAverage[i - 1] == null ? "M" : "L"}${MX(i).toFixed(1)} ${MY(v).toFixed(1)}`))
    .join(" "),
  candles: candles.map((x, i) => ({
    i,
    a: (i * 0.8).toFixed(1),
    b: (20 + i * 0.8).toFixed(1),
    cx: MX(i).toFixed(1),
    hy: MY(x.h).toFixed(1),
    ly: MY(x.l).toFixed(1),
    bx: (MX(i) - bodyW / 2).toFixed(1),
    by: Math.min(MY(x.o), MY(x.c)).toFixed(1),
    bw: bodyW.toFixed(1),
    bh: Math.max(2, Math.abs(MY(x.o) - MY(x.c))).toFixed(1),
    up: x.c >= x.o,
  })),
};

/* ---------- Casino ---------- */

export const GAMES = [
  {
    name: "Blackjack",
    rtp: 99,
    min: 20,
    max: 2000,
    icon: "M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM12 8l2.5 4L12 16l-2.5-4z",
  },
  { name: "Coinflip", rtp: 98, min: 5, max: 250, icon: MODULE_ICONS.Balance },
  {
    name: "Roulette",
    rtp: 97,
    min: 10,
    max: 1000,
    icon: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 3v4M12 17v4M3 12h4M17 12h4",
  },
  { name: "Slots", rtp: 96, min: 10, max: 500, icon: MODULE_ICONS.Casino },
] as const;

/* ---------- Community ---------- */

export const MEMBERS = [
  { name: "Aiko", role: "Moderator", joined: "Mar 2024", messages: 12480 },
  { name: "Ren", role: "Regular", joined: "Jun 2024", messages: 9310 },
  { name: "Sora", role: "Booster", joined: "Jan 2025", messages: 6720 },
  { name: "Hana", role: "Member", joined: "Aug 2025", messages: 3890 },
  { name: "Yuki", role: "Member", joined: "Oct 2025", messages: 1240 },
] as const;

/** Background, skin and clothes of each drawn avatar, then its hair and accessories. */
const AVATARS: readonly (readonly [string, string, string, string])[] = [
  [
    "#3b2f4a",
    "#e8b49a",
    "#ff6a5f",
    '<path d="M14 26c0-14 9-20 18-20s18 6 18 20c-4-6-9-9-18-9s-14 3-18 9z" fill="#1c1420"/><path d="M13 30v8M51 30v8" stroke="#1c1420" stroke-width="5" stroke-linecap="round"/><path d="M10 31a22 22 0 0 1 44 0" fill="none" stroke="#2a2a30" stroke-width="3.5"/><rect x="7" y="29" width="7" height="11" rx="3" fill="#4a4a52"/><rect x="50" y="29" width="7" height="11" rx="3" fill="#4a4a52"/>',
  ],
  [
    "#27404a",
    "#d9a68c",
    "#6aa7ff",
    '<path d="M15 31c-3-16 6-24 17-24s20 8 17 24c-2-8-6-12-10-13-6 3-14 3-19 0-3 2-5 6-5 13z" fill="#2b2b30"/><circle cx="25" cy="33" r="5.5" fill="none" stroke="#f0efed" stroke-width="1.6"/><circle cx="39" cy="33" r="5.5" fill="none" stroke="#f0efed" stroke-width="1.6"/><path d="M30.5 33h3" stroke="#f0efed" stroke-width="1.6"/>',
  ],
  [
    "#4a3a2a",
    "#f1c9ad",
    "#fbbf24",
    '<path d="M13 34c-5-20 4-29 19-29s24 9 19 29c-1-9-3-14-8-17-7 3-15 2-22-1-5 3-7 9-8 18z" fill="#e8c27a"/><path d="M13 34c-2 8 0 15 4 20M51 34c2 8 0 15-4 20" stroke="#e8c27a" stroke-width="5" stroke-linecap="round" fill="none"/><path d="M42 12l4-5 3 6z" fill="#ff6a5f"/>',
  ],
  [
    "#2f4a3a",
    "#c98f74",
    "#4ade80",
    '<path d="M14 36c-4-22 5-30 18-30s22 8 18 30c-2-10-3-15-8-17-6 2-14 2-20 0-5 3-6 8-8 17z" fill="#5a2f3a"/><circle cx="14" cy="22" r="6" fill="#5a2f3a"/><circle cx="50" cy="22" r="6" fill="#5a2f3a"/><circle cx="14" cy="22" r="2.2" fill="#ff8a80"/><circle cx="50" cy="22" r="2.2" fill="#ff8a80"/>',
  ],
  [
    "#3a3a40",
    "#e2b093",
    "#a6a6ad",
    '<path d="M12 36c-1-18 8-26 20-26s21 8 20 26c-2-6-3-9-6-11-9 2-19 2-28 0-3 2-4 6-6 11z" fill="#1a1a1e"/><path d="M10 40c0-10 4-14 10-15h24c6 1 10 5 10 15-4-3-9-4-14-4H24c-5 0-10 1-14 4z" fill="#26262a"/><path d="M22 20h20" stroke="#ff6a5f" stroke-width="2.5" stroke-linecap="round"/>',
  ],
];

/** A small drawn portrait, so the sample members never show a real person's avatar. */
export function avatarUri(index: number): string {
  const [bg, skin, clothes, extra] = AVATARS[index % AVATARS.length];
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${bg}"/>` +
    `<path d="M6 66c1-12 11-17 26-17s25 5 26 17z" fill="${clothes}"/><rect x="27" y="40" width="10" height="12" fill="${skin}"/>` +
    `<ellipse cx="32" cy="32" rx="12.5" ry="14" fill="${skin}"/><circle cx="26.5" cy="33" r="1.5" fill="#1a1a1e"/>` +
    `<circle cx="37.5" cy="33" r="1.5" fill="#1a1a1e"/><path d="M29 40q3 2.5 6 0" stroke="#7a3f33" stroke-width="1.5" fill="none" stroke-linecap="round"/>` +
    `${extra}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** The module switches of the "try it here" grid, with their starting state. */
export const MODULE_SWITCHES: readonly (readonly [string, ModuleKey, boolean])[] = [
  ["antiraid", "Anti-Raid", true],
  ["moderation", "Moderation", true],
  ["phaethon", "Phaethon", true],
  ["balance", "Balance", true],
  ["casino", "Casino", false],
  ["profiling", "Profiling", true],
];

/* ---------- Dashboard preview ---------- */

export const DASH_NAV: readonly ModuleKey[] = [
  "Dashboard",
  "Anti-Raid",
  "Moderation",
  "Phaethon",
  "Balance",
  "Casino",
  "Profiling",
  "Modules",
];

const hourly = (f: (h: number) => number) =>
  Array.from({ length: 24 }, (_, h) => `${h ? "L" : "M"}${(10 + h * (580 / 23)).toFixed(1)} ${f(h).toFixed(1)}`).join(" ");

export const DASH_LINE = hourly(
  (h) =>
    150 -
    (40 + 70 * Math.exp(-((h - 20) ** 2) / 18) + 30 * Math.exp(-((h - 13) ** 2) / 10) + (h === 15 ? 45 : 0)),
);
export const DASH_LINE_2 = hourly((h) => 160 - (15 + 40 * Math.exp(-((h - 21) ** 2) / 12)));

export const DASH_ROWS = [
  { score: 92, high: true, name: "shadow.fox_88" },
  { score: 81, high: true, name: "nova_trade" },
  { score: 58, high: false, name: "pixel_ren" },
] as const;

/* ---------- Language flags (60×40 viewBox) ---------- */

export type FlagShape = { d: string; fill: string; stroke: string; width: number };

export const FLAGS: Record<"en" | "fr", readonly FlagShape[]> = {
  en: [
    { d: "M0 0h60v40H0z", fill: "#012169", stroke: "none", width: 0 },
    { d: "M0 0L60 40M60 0L0 40", fill: "none", stroke: "#ffffff", width: 8 },
    { d: "M0 0L60 40M60 0L0 40", fill: "none", stroke: "#c8102e", width: 3 },
    { d: "M30 0v40M0 20h60", fill: "none", stroke: "#ffffff", width: 13 },
    { d: "M30 0v40M0 20h60", fill: "none", stroke: "#c8102e", width: 7 },
  ],
  fr: [
    { d: "M0 0h20v40H0z", fill: "#1d3f9e", stroke: "none", width: 0 },
    { d: "M20 0h20v40H20z", fill: "#ffffff", stroke: "none", width: 0 },
    { d: "M40 0h20v40H40z", fill: "#e03a3e", stroke: "none", width: 0 },
  ],
};

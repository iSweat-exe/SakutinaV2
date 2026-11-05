/** Sample data behind the locked sections of the dashboard (not real figures). */

const bump = (hour: number, center: number, width: number) => Math.exp(-Math.pow(hour - center, 2) / width);

export const SAMPLE_MESSAGES = Array.from({ length: 24 }, (_, h) =>
  Math.round(55 + 120 * bump(h, 20, 40) + 55 * bump(h, 12, 30) + 190 * bump(h, 15.5, 1.3)),
);

export const SAMPLE_VOICE = Array.from({ length: 24 }, (_, h) =>
  Math.round(15 + 85 * bump(h, 21, 18) + 30 * bump(h, 14, 20)),
);

export const SAMPLE_RAID = { from: 14.6, to: 16.7 } as const;

export const SAMPLE_KPIS = [
  { label: "Messages", value: "48,213", sub: "Last 24 hours" },
  { label: "Coins in circulation", value: "1.2M", sub: "Across all members" },
  { label: "Active members", value: "212", sub: "Out of 1,284" },
] as const;

export const SAMPLE_FLAGGED = [
  { name: "shadow.fox_88", reason: "Joined with 6 similar accounts", when: "4 min ago" },
  { name: "nova_trade", reason: "Link spam in 3 channels", when: "19 min ago" },
  { name: "kaito.alt2", reason: "Possible alt of a banned user", when: "1 h ago" },
] as const;

export const SAMPLE_LOGS = [
  { tag: "Mute", text: "echo.vale muted for 10 minutes (mention limit)", when: "2 min ago" },
  { tag: "Join", text: "14 members joined in the last 10 minutes", when: "5 min ago" },
  { tag: "Giveaway", text: "“Friday Drop” ended with 3 winners", when: "18 min ago" },
  { tag: "Mute", text: "drift.kuro muted for 1 hour by Mika", when: "34 min ago" },
  { tag: "Join", text: "9 members joined in the last 10 minutes", when: "1 h ago" },
  { tag: "Giveaway", text: "“Movie Night” started, ends in 2 days", when: "2 h ago" },
] as const;

export const TOGGLE_DEFS = [
  { id: "casino", label: "Casino" },
  { id: "antiraid", label: "Anti-Raid" },
  { id: "phaethon", label: "Phaethon" },
  { id: "profiling", label: "Profiling" },
] as const;

export type ToggleId = (typeof TOGGLE_DEFS)[number]["id"];

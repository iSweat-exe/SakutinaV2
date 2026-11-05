/** Sample data behind the locked sections of the dashboard (not real figures). */

export const SAMPLE_FLAGGED = [
  { name: "shadow.fox_88", reason: "Joined with 6 similar accounts", when: "4 min ago" },
  { name: "nova_trade", reason: "Link spam in 3 channels", when: "19 min ago" },
  { name: "kaito.alt2", reason: "Possible alt of a banned user", when: "1 h ago" },
] as const;

export const TOGGLE_DEFS = [
  { id: "casino", label: "Casino" },
  { id: "antiraid", label: "Anti-Raid" },
  { id: "phaethon", label: "Phaethon" },
  { id: "profiling", label: "Profiling" },
] as const;

export type ToggleId = (typeof TOGGLE_DEFS)[number]["id"];

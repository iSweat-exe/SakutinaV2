/** Sample data behind the locked sections of the dashboard (not real figures). */

export const TOGGLE_DEFS = [
  { id: "casino", label: "Casino" },
  { id: "antiraid", label: "Anti-Raid" },
  { id: "phaethon", label: "Phaethon" },
  { id: "profiling", label: "Profiling" },
] as const;

export type ToggleId = (typeof TOGGLE_DEFS)[number]["id"];

/** Shape returned by `panel_modules`, and its validation (no I/O). */

/** Modules an admin can switch on or off (migration 0022; Anti-Raid since 0021). */
export const MODULE_IDS = ["antiraid", "casino", "phaethon", "profiling"] as const;
export type ModuleId = (typeof MODULE_IDS)[number];

export type Modules = Readonly<Record<ModuleId, boolean> & { raidActive: boolean }>;

export const isModuleId = (value: unknown): value is ModuleId => (MODULE_IDS as readonly unknown[]).includes(value);

export function parseModules(value: unknown): Modules | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const v = value as Record<string, unknown>;

  if (!MODULE_IDS.every((id) => typeof v[id] === "boolean") || typeof v.raid_active !== "boolean") {
    return null;
  }

  return {
    antiraid: v.antiraid as boolean,
    casino: v.casino as boolean,
    phaethon: v.phaethon as boolean,
    profiling: v.profiling as boolean,
    raidActive: v.raid_active,
  };
}

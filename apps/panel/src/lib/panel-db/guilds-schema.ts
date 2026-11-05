/** A server as `panel_guild` / `panel_my_guilds` return it, and its validation (no I/O). */
export type PanelGuild = Readonly<{
  id: string;
  /** `null` when the bot is not on the server (access granted manually through `panel_admin`). */
  name: string | null;
  icon: string | null;
  banner: string | null;
  memberCount: number | null;
  role: "admin" | "owner";
}>;

const text = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const optionalText = (value: unknown): string | null => (text(value) ? value : null);

/** One server; `null` for anything that does not have the expected shape. */
export function parseGuild(value: unknown): PanelGuild | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const v = value as Record<string, unknown>;

  if (!text(v.id) || !/^\d{5,25}$/.test(v.id) || (v.role !== "admin" && v.role !== "owner")) {
    return null;
  }

  return {
    id: v.id,
    name: optionalText(v.name),
    icon: optionalText(v.icon),
    banner: optionalText(v.banner),
    memberCount: typeof v.member_count === "number" ? v.member_count : null,
    role: v.role,
  };
}

/** The list of `panel_my_guilds`; a malformed entry makes the whole answer invalid. */
export function parseGuildList(value: unknown): ReadonlyArray<PanelGuild> | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const guilds = value.map(parseGuild);

  return guilds.every((guild) => guild !== null) ? (guilds as PanelGuild[]) : null;
}

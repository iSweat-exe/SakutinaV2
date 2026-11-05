/**
 * The Discord servers of the signed-in user.
 *
 * Supabase only hands out the Discord access token once, at sign-in. The callback
 * reads the servers right then (`guilds` scope) and keeps a compact copy in a cookie,
 * so the panel never stores the token and never calls Discord again.
 */

export type UserGuild = Readonly<{
  id: string;
  name: string;
  /** Discord's icon hash, or null when the server has no picture. */
  icon: string | null;
  /** Discord's banner hash. Kept only for servers the user can manage (the rows that show it). */
  banner: string | null;
  /** Owner, Administrator or Manage Server: the user could add a bot there. */
  canManage: boolean;
}>;

export const GUILDS_COOKIE = "sakutina_guilds";
/** One hour: long enough for a session, short enough that a server list does not go stale. */
export const GUILDS_COOKIE_MAX_AGE = 60 * 60;

/** Browsers refuse cookies over ~4 KB; stay below it once URL-encoded. */
const COOKIE_BUDGET = 3_600;
const NAME_MAX = 32;
/** Discord image hashes (icons, banners): 32 hex characters, `a_` for animated ones. */
const IMAGE_HASH = /^(?:a_)?[a-f0-9]{32}$/;
const ADMINISTRATOR = BigInt(0x8);
const MANAGE_GUILD = BigInt(0x20);

const imageHash = (value: unknown): string | null => (typeof value === "string" && IMAGE_HASH.test(value) ? value : null);

function canManage(owner: unknown, permissions: unknown): boolean {
  if (owner === true) {
    return true;
  }

  try {
    const bits = BigInt(typeof permissions === "string" ? permissions : "0");
    return (bits & (ADMINISTRATOR | MANAGE_GUILD)) !== BigInt(0);
  } catch {
    return false;
  }
}

/** Orders manageable servers first, then by name, so truncation drops the least useful ones. */
function byUsefulness(a: UserGuild, b: UserGuild): number {
  return Number(b.canManage) - Number(a.canManage) || a.name.localeCompare(b.name);
}

/** Reads Discord's `GET /users/@me/guilds` body. Anything unexpected is ignored. */
export function parseDiscordGuilds(body: unknown): UserGuild[] {
  if (!Array.isArray(body)) {
    return [];
  }

  const guilds: UserGuild[] = [];

  for (const item of body) {
    const entry = item as Record<string, unknown> | null;

    if (entry && typeof entry.id === "string" && /^\d{5,25}$/.test(entry.id) && typeof entry.name === "string") {
      const manageable = canManage(entry.owner, entry.permissions);

      guilds.push({
        id: entry.id,
        name: entry.name.slice(0, NAME_MAX),
        icon: imageHash(entry.icon),
        banner: manageable ? imageHash(entry.banner) : null,
        canManage: manageable,
      });
    }
  }

  return guilds.sort(byUsefulness);
}

/** Compact cookie value: `[[id, name, 1|0, icon, banner], …]`, cut to fit the budget. */
export function encodeGuilds(guilds: readonly UserGuild[]): string {
  type Row = [string, string, 0 | 1, string, string];
  const kept: Row[] = [];

  for (const guild of [...guilds].sort(byUsefulness)) {
    const next: Row[] = [
      ...kept,
      [guild.id, guild.name, guild.canManage ? 1 : 0, guild.icon ?? "", guild.canManage ? (guild.banner ?? "") : ""],
    ];

    if (encodeURIComponent(JSON.stringify(next)).length > COOKIE_BUDGET) {
      break;
    }

    kept.push(next[next.length - 1]);
  }

  return JSON.stringify(kept);
}

/** Inverse of {@link encodeGuilds}. A missing or damaged cookie gives `null`. */
export function decodeGuilds(value: string | undefined): UserGuild[] | null {
  if (!value) {
    return null;
  }

  try {
    const rows: unknown = JSON.parse(value);

    if (!Array.isArray(rows)) {
      return null;
    }

    const guilds: UserGuild[] = [];

    for (const row of rows) {
      if (Array.isArray(row) && typeof row[0] === "string" && typeof row[1] === "string") {
        guilds.push({
          id: row[0],
          name: row[1],
          canManage: row[2] === 1,
          icon: imageHash(row[3]),
          banner: imageHash(row[4]),
        });
      }
    }

    return guilds;
  } catch {
    return null;
  }
}

/** The server's picture on Discord's CDN, or `null` (the row then shows the initial). */
export function guildIconUrl(guild: Readonly<{ id: string; icon: string | null }>): string | null {
  return guild.icon && IMAGE_HASH.test(guild.icon)
    ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=64`
    : null;
}

/** The server's banner on Discord's CDN (shown when a row is hovered), or `null`. */
export function guildBannerUrl(guild: Readonly<{ id: string; banner: string | null }>): string | null {
  return guild.banner && IMAGE_HASH.test(guild.banner)
    ? `https://cdn.discordapp.com/banners/${guild.id}/${guild.banner}.png?size=600`
    : null;
}

/** The signed-in user's servers, read with their Discord access token. Never throws. */
export async function fetchUserGuilds(accessToken: string): Promise<UserGuild[]> {
  try {
    const response = await fetch("https://discord.com/api/v10/users/@me/guilds", {
      headers: { authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });

    return response.ok ? parseDiscordGuilds(await response.json()) : [];
  } catch {
    return [];
  }
}

/**
 * Discord's "add this bot" page, preselecting the server. `null` when the panel does not
 * know the bot's application id (NEXT_PUBLIC_DISCORD_APPLICATION_ID): the button is then hidden.
 */
export function inviteUrl(guildId: string): string | null {
  const applicationId = process.env.NEXT_PUBLIC_DISCORD_APPLICATION_ID?.trim();

  if (!applicationId || !/^\d+$/.test(applicationId)) {
    return null;
  }

  const query = new URLSearchParams({
    client_id: applicationId,
    scope: "bot applications.commands",
    guild_id: guildId,
    disable_guild_select: "true",
  });

  return `https://discord.com/oauth2/authorize?${query}`;
}

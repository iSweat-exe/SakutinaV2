/**
 * Sakutina is single-server: the panel manages one Discord server.
 * The name is display-only; the bot decides which guild it serves.
 */
const name = process.env.NEXT_PUBLIC_GUILD_NAME?.trim() || "Uwu Server";

export const PRIMARY_GUILD = {
  name,
  initial: name.charAt(0).toUpperCase(),
} as const;

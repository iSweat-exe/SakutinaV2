import "server-only";
import { parseGuild, parseGuildList, type PanelGuild } from "./guilds-schema";
import { callGuildFunction, callPanelFunction } from "./rpc";

/** Servers the bot is on that the signed-in user can manage. Throws PanelForbiddenError / PanelDataError. */
export function getMyGuilds(): Promise<ReadonlyArray<PanelGuild>> {
  return callPanelFunction("panel_my_guilds", {}, parseGuildList);
}

/** One server's card (sidebar). Throws PanelForbiddenError when the user cannot manage it. */
export function getGuild(guildId: string): Promise<PanelGuild> {
  return callGuildFunction("panel_guild", guildId, {}, parseGuild);
}

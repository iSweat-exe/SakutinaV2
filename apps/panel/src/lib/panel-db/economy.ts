import "server-only";
import { parseEconomy, type Economy } from "./economy-schema";
import { callGuildFunction } from "./rpc";

/** One server's economy, with the signed-in user's session. Throws PanelForbiddenError / PanelDataError. */
export function getEconomy(guildId: string): Promise<Economy> {
  return callGuildFunction("panel_economy", guildId, {}, parseEconomy);
}

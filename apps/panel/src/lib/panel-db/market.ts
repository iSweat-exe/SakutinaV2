import "server-only";
import { parseMarket, type Market, type Period } from "./market-schema";
import { callGuildFunction } from "./rpc";

/** The Casino share of one server for one candle period, with the signed-in user's session. */
export function getMarket(guildId: string, period: Period): Promise<Market> {
  return callGuildFunction("panel_market", guildId, { p_period: period }, parseMarket);
}

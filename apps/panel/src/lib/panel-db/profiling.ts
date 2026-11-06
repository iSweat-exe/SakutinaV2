import "server-only";
import { parseProfiling, type Profiling } from "./profiling-schema";
import { callGuildFunction } from "./rpc";

/**
 * One server's member profiles, with the signed-in user's session: the most active members, or those matching
 * `query` (name, username or exact id). Throws PanelForbiddenError / PanelDataError.
 */
export function getProfiling(guildId: string, query?: string): Promise<Profiling> {
  return callGuildFunction("panel_profiling", guildId, query ? { p_query: query } : {}, parseProfiling);
}

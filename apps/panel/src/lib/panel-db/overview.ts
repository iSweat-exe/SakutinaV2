import "server-only";
import { parseOverview, type Overview } from "./schema";
import { callGuildFunction } from "./rpc";

/** Figures of the dashboard. Throws PanelForbiddenError / PanelDataError. */
export function getOverview(guildId: string): Promise<Overview> {
  return callGuildFunction("panel_overview", guildId, {}, parseOverview);
}

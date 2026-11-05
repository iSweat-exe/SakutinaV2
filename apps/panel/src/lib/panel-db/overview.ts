import "server-only";
import { parseOverview, type Overview } from "./schema";
import { callPanelFunction } from "./rpc";

/** Figures of the dashboard. Throws PanelForbiddenError / PanelDataError. */
export function getOverview(): Promise<Overview> {
  return callPanelFunction("panel_overview", {}, parseOverview);
}

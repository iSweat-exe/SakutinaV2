import "server-only";
import { parseAudit, type AuditEntry } from "./schema";
import { callPanelFunction } from "./rpc";

/** Latest moderation actions, newest first. */
export function getRecentModeration(limit = 6): Promise<ReadonlyArray<AuditEntry>> {
  return callPanelFunction("panel_recent_audit", { p_limit: limit }, parseAudit);
}

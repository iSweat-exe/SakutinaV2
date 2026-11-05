import "server-only";
import { parseAudit, type AuditEntry } from "./schema";
import { callGuildFunction } from "./rpc";

/** Latest moderation actions, newest first. */
export function getRecentModeration(guildId: string, limit = 6): Promise<ReadonlyArray<AuditEntry>> {
  return callGuildFunction("panel_recent_audit", guildId, { p_limit: limit }, parseAudit);
}

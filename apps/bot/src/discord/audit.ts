import type { HandlerContext } from "@/discord/handler-context.ts";
import type { AuditAction } from "@/domain/audit/audit-event.ts";
import { logger } from "@/shared/logger.ts";

/** Journalise une action d'administration ou de modération : qui, sur qui, quand, avec quel résultat. */
export async function recordAudit(
  { auditLog }: HandlerContext,
  guildId: string,
  action: AuditAction,
  actorId: string | null,
  targetId: string | null,
  metadata: Readonly<Record<string, string | number | boolean | null>> = {},
): Promise<void> {
  try {
    await auditLog.append({
      id: crypto.randomUUID(),
      action,
      guildId,
      occurredAt: new Date(),
      actorId,
      targetId,
      metadata,
    });
  } catch (error) {
    logger.error("Failed to append audit event", {
      action,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

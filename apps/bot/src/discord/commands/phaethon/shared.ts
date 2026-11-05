import type { HandlerContext } from "@/discord/handler-context.ts";
import type { AuditAction } from "@/domain/audit/audit-event.ts";
import { logger } from "@/shared/logger.ts";

/** Toute consultation de Phaéthon est journalisée : qui a regardé quoi, et quand. */
export async function recordConsultation(
  { auditLog, config }: HandlerContext,
  action: AuditAction,
  actorId: string,
  targetId: string | null,
  metadata: Readonly<Record<string, string | number | boolean | null>> = {},
): Promise<void> {
  try {
    await auditLog.append({
      id: crypto.randomUUID(),
      action,
      guildId: config.primaryGuildId,
      occurredAt: new Date(),
      actorId,
      targetId,
      metadata,
    });
  } catch (error) {
    logger.error("Failed to append consultation audit event", {
      action,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

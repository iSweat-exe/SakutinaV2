import { desc, eq, lt } from "drizzle-orm";

import type {
  AuditAction,
  AuditEvent,
  AuditLog,
} from "@/domain/audit/audit-event.ts";
import type { Database } from "@/database/postgres/connection.ts";
import { auditEvent } from "@/database/postgres/schema/index.ts";

export class PostgresAuditLog implements AuditLog {
  constructor(private readonly db: Database) {}

  async append(event: AuditEvent): Promise<void> {
    await this.db.insert(auditEvent).values({
      id: event.id,
      action: event.action,
      guildId: event.guildId,
      occurredAt: event.occurredAt,
      actorId: event.actorId,
      targetId: event.targetId,
      metadata: event.metadata,
    });
  }

  async listForGuild(
    guildId: string,
    limit: number,
  ): Promise<readonly AuditEvent[]> {
    const rows = await this.db
      .select()
      .from(auditEvent)
      .where(eq(auditEvent.guildId, guildId))
      .orderBy(desc(auditEvent.occurredAt))
      .limit(limit);

    return rows.map((row) => ({
      id: row.id,
      action: row.action as AuditAction,
      guildId: row.guildId,
      occurredAt: row.occurredAt,
      actorId: row.actorId,
      targetId: row.targetId,
      metadata: row.metadata as AuditEvent["metadata"],
    }));
  }

  async purgeBefore(before: Date): Promise<number> {
    const removed = await this.db
      .delete(auditEvent)
      .where(lt(auditEvent.occurredAt, before))
      .returning({ id: auditEvent.id });

    return removed.length;
  }
}

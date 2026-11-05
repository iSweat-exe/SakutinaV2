import type { AuditEvent, AuditLog } from "@/domain/audit/audit-event.ts";

const MAX_EVENTS = 5_000;

/** Stockage de développement et de test : perdu au redémarrage. */
export class MemoryAuditLog implements AuditLog {
  private events: AuditEvent[] = [];

  async append(event: AuditEvent): Promise<void> {
    this.events.push(event);

    if (this.events.length > MAX_EVENTS) {
      this.events.shift();
    }
  }

  async listForGuild(
    guildId: string,
    limit: number,
  ): Promise<readonly AuditEvent[]> {
    return this.events
      .filter((event) => event.guildId === guildId)
      .slice(-limit)
      .reverse();
  }

  async purgeBefore(before: Date): Promise<number> {
    const kept = this.events.filter(
      (event) => event.occurredAt.getTime() >= before.getTime(),
    );
    const removed = this.events.length - kept.length;
    this.events = kept;

    return removed;
  }
}

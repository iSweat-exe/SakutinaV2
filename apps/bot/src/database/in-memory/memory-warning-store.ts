import type { NewWarning, Warning } from "@/domain/moderation/moderation-types.ts";
import type { WarningStore } from "@/domain/moderation/warning-store.ts";

/** Stockage de développement et de test : perdu au redémarrage. */
export class MemoryWarningStore implements WarningStore {
  private readonly warnings = new Map<number, Warning>();
  private next = 1;

  async add(warning: NewWarning): Promise<Warning> {
    const created = { ...warning, id: this.next };
    this.next += 1;
    this.warnings.set(created.id, created);

    return created;
  }

  async listForMember(guildId: string, memberId: string, limit: number): Promise<readonly Warning[]> {
    return [...this.warnings.values()]
      .filter((warning) => warning.guildId === guildId && warning.memberId === memberId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id)
      .slice(0, limit);
  }

  async count(guildId: string, memberId: string): Promise<number> {
    return (await this.listForMember(guildId, memberId, Number.MAX_SAFE_INTEGER)).length;
  }

  async remove(guildId: string, id: number): Promise<boolean> {
    const warning = this.warnings.get(id);

    return warning?.guildId === guildId ? this.warnings.delete(id) : false;
  }

  async purgeBefore(before: Date): Promise<number> {
    let removed = 0;

    for (const [id, warning] of this.warnings) {
      if (warning.createdAt.getTime() < before.getTime()) {
        this.warnings.delete(id);
        removed += 1;
      }
    }

    return removed;
  }
}

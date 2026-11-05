import type {
  NewSanction,
  Sanction,
  SanctionCommand,
  SanctionKind,
  SanctionStore,
} from "@/domain/moderation/sanction-store.ts";

type StoredCommand = SanctionCommand & { status: "pending" | "done" | "failed" };

/** Stockage de développement et de test : perdu au redémarrage. */
export class MemorySanctionStore implements SanctionStore {
  readonly sanctions: Sanction[] = [];
  private readonly commands: StoredCommand[] = [];
  private next = 1;

  async add(sanction: NewSanction): Promise<Sanction> {
    await this.close(sanction.guildId, sanction.memberId, sanction.kind, sanction.createdAt, null);

    const created: Sanction = { ...sanction, id: this.next, revokedAt: null, revokedBy: null };
    this.next += 1;
    this.sanctions.push(created);

    return created;
  }

  async close(guildId: string, memberId: string, kind: SanctionKind, at: Date, by: string | null): Promise<number> {
    let closed = 0;

    this.sanctions.forEach((sanction, index) => {
      if (isActive(sanction, at) && sanction.guildId === guildId && sanction.memberId === memberId && sanction.kind === kind) {
        this.sanctions[index] = { ...sanction, revokedAt: at, revokedBy: by };
        closed += 1;
      }
    });

    return closed;
  }

  async find(id: number): Promise<Sanction | null> {
    return this.sanctions.find((sanction) => sanction.id === id) ?? null;
  }

  async hasActive(guildId: string, memberId: string, kind: SanctionKind, now: Date): Promise<boolean> {
    return this.sanctions.some(
      (sanction) => sanction.guildId === guildId && sanction.memberId === memberId && sanction.kind === kind && isActive(sanction, now),
    );
  }

  async purgeClosedBefore(before: Date): Promise<number> {
    const kept = this.sanctions.filter((sanction) => {
      const ended = sanction.revokedAt ?? sanction.endsAt;

      return !(ended && ended.getTime() < before.getTime());
    });
    const removed = this.sanctions.length - kept.length;
    this.sanctions.splice(0, this.sanctions.length, ...kept);

    return removed;
  }

  async enqueueCommand(guildId: string, sanctionId: number, requestedBy: string): Promise<void> {
    this.commands.push({ id: crypto.randomUUID(), guildId, sanctionId, requestedBy, status: "pending" });
  }

  async pendingCommands(limit: number): Promise<readonly SanctionCommand[]> {
    return this.commands
      .filter((command) => command.status === "pending")
      .slice(0, limit)
      .map(({ id, guildId, sanctionId, requestedBy }) => ({ id, guildId, sanctionId, requestedBy }));
  }

  async finishCommand(id: string, status: "done" | "failed"): Promise<void> {
    const command = this.commands.find((candidate) => candidate.id === id);

    if (command) {
      command.status = status;
    }
  }
}

function isActive(sanction: Sanction, now: Date): boolean {
  return sanction.revokedAt === null && (sanction.endsAt === null || sanction.endsAt.getTime() > now.getTime());
}

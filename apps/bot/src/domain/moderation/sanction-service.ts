import {
  AUTOMOD_ACTOR,
  type Sanction,
  type SanctionCommand,
  type SanctionKind,
  type SanctionStore,
} from "./sanction-store.ts";

const DAY_MS = 86_400_000;

/** Sanctions closées ou échues : gardées 30 jours comme le journal d'audit, puis supprimées. */
export const CLOSED_SANCTION_RETENTION_DAYS = 30;

/** Les sanctions actives (mutes, bannissements) que le panneau affiche et peut lever. */
export class SanctionService {
  constructor(
    private readonly store: SanctionStore,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  recordMute(guildId: string, memberId: string, moderatorId: string | null, reason: string, durationMs: number): Promise<Sanction> {
    const now = this.clock();

    return this.store.add({
      guildId,
      memberId,
      kind: "mute",
      moderatorId,
      reason,
      createdAt: now,
      endsAt: new Date(now.getTime() + durationMs),
    });
  }

  recordBan(guildId: string, memberId: string, moderatorId: string | null, reason: string): Promise<Sanction> {
    return this.store.add({ guildId, memberId, kind: "ban", moderatorId, reason, createdAt: this.clock(), endsAt: null });
  }

  /** Une sanction vue dans Discord (auteur inconnu) n'est enregistrée que si le bot ne la connaît pas déjà. */
  async recordUnknownIfAbsent(
    kind: SanctionKind,
    guildId: string,
    memberId: string,
    reason: string,
    endsAt: Date | null,
  ): Promise<boolean> {
    const now = this.clock();

    if (await this.store.hasActive(guildId, memberId, kind, now)) {
      return false;
    }

    await this.store.add({ guildId, memberId, kind, moderatorId: null, reason, createdAt: now, endsAt: kind === "mute" ? endsAt : null });

    return true;
  }

  /** Le mute ou le bannissement a pris fin (levé par un modérateur, par le panneau ou dans Discord). */
  clear(kind: SanctionKind, guildId: string, memberId: string, by: string | null): Promise<number> {
    return this.store.close(guildId, memberId, kind, this.clock(), by);
  }

  find(id: number): Promise<Sanction | null> {
    return this.store.find(id);
  }

  pendingCommands(limit = 10): Promise<readonly SanctionCommand[]> {
    return this.store.pendingCommands(limit);
  }

  finishCommand(id: string, status: "done" | "failed", error?: string): Promise<void> {
    return this.store.finishCommand(id, status, this.clock(), error);
  }

  purgeExpired(now = this.clock()): Promise<number> {
    return this.store.purgeClosedBefore(new Date(now.getTime() - CLOSED_SANCTION_RETENTION_DAYS * DAY_MS));
  }
}

export { AUTOMOD_ACTOR };

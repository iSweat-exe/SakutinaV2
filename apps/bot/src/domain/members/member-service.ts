import type { MemberProfile } from "./member-profile.ts";
import type { MemberStore, SeedMember } from "./member-store.ts";

const DAY_MS = 86_400_000;

/** Durée pendant laquelle la fiche d'un membre parti est conservée. */
export const DEPARTED_PROFILE_RETENTION_DAYS = 30;

export class MemberService {
  constructor(
    private readonly store: MemberStore,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  seed(guildId: string, members: readonly SeedMember[]): Promise<void> {
    return this.store.seed(guildId, members, this.clock());
  }

  markJoined(guildId: string, memberId: string, at = this.clock()): Promise<void> {
    return this.store.markJoined(guildId, memberId, at);
  }

  markLeft(guildId: string, memberId: string, at = this.clock()): Promise<void> {
    return this.store.markLeft(guildId, memberId, at);
  }

  find(guildId: string, memberId: string): Promise<MemberProfile | null> {
    return this.store.find(guildId, memberId);
  }

  /** Membres sans activité depuis au moins `days` jours. */
  inactive(guildId: string, days: number, limit: number): Promise<readonly MemberProfile[]> {
    const before = new Date(this.clock().getTime() - days * DAY_MS);

    return this.store.listInactive(guildId, before, limit);
  }

  forget(guildId: string, memberId: string): Promise<void> {
    return this.store.delete(guildId, memberId);
  }

  purgeDeparted(): Promise<number> {
    const before = new Date(
      this.clock().getTime() - DEPARTED_PROFILE_RETENTION_DAYS * DAY_MS,
    );

    return this.store.purgeLeftBefore(before);
  }
}

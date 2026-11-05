import type { PresenceDelta } from "@/domain/activity/activity-types.ts";
import { inactivityReference, type MemberIdentity, type MemberProfile } from "@/domain/members/member-profile.ts";
import type { MemberStore, SeedMember } from "@/domain/members/member-store.ts";

/** Stockage de développement et de test : perdu au redémarrage. */
export class MemoryMemberStore implements MemberStore {
  private readonly profiles = new Map<string, MemberProfile>();

  async touch(presences: readonly PresenceDelta[]): Promise<void> {
    for (const { guildId, memberId, at } of presences) {
      const current = this.profiles.get(keyOf(guildId, memberId));

      this.profiles.set(keyOf(guildId, memberId), {
        guildId,
        memberId,
        firstSeenAt: current?.firstSeenAt ?? at,
        joinedAt: current?.joinedAt ?? null,
        leftAt: current?.leftAt ?? null,
        lastActiveAt:
          current?.lastActiveAt && current.lastActiveAt.getTime() > at.getTime()
            ? current.lastActiveAt
            : at,
        displayName: current?.displayName ?? null,
        avatar: current?.avatar ?? null,
      });
    }
  }

  async seed(guildId: string, members: readonly SeedMember[], now: Date): Promise<void> {
    for (const { memberId, joinedAt, identity } of members) {
      const key = keyOf(guildId, memberId);
      const current = this.profiles.get(key);
      const names = identity ? { displayName: identity.displayName, avatar: identity.avatar } : {};

      this.profiles.set(
        key,
        current
          ? { ...current, joinedAt: current.joinedAt ?? joinedAt, ...names }
          : { guildId, memberId, firstSeenAt: now, joinedAt, leftAt: null, lastActiveAt: null, ...names },
      );
    }
  }

  async setIdentity(guildId: string, memberId: string, identity: MemberIdentity): Promise<void> {
    const current = this.profiles.get(keyOf(guildId, memberId));

    if (current) {
      this.profiles.set(keyOf(guildId, memberId), { ...current, displayName: identity.displayName, avatar: identity.avatar });
    }
  }

  async markJoined(guildId: string, memberId: string, at: Date): Promise<void> {
    const current = this.profiles.get(keyOf(guildId, memberId));

    this.profiles.set(keyOf(guildId, memberId), {
      guildId,
      memberId,
      firstSeenAt: current?.firstSeenAt ?? at,
      joinedAt: at,
      leftAt: null,
      lastActiveAt: current?.lastActiveAt ?? null,
      displayName: current?.displayName ?? null,
      avatar: current?.avatar ?? null,
    });
  }

  async markLeft(guildId: string, memberId: string, at: Date): Promise<void> {
    const current = this.profiles.get(keyOf(guildId, memberId));

    this.profiles.set(keyOf(guildId, memberId), {
      guildId,
      memberId,
      firstSeenAt: current?.firstSeenAt ?? at,
      joinedAt: current?.joinedAt ?? null,
      leftAt: at,
      lastActiveAt: current?.lastActiveAt ?? null,
      displayName: current?.displayName ?? null,
      avatar: current?.avatar ?? null,
    });
  }

  async find(guildId: string, memberId: string): Promise<MemberProfile | null> {
    return this.profiles.get(keyOf(guildId, memberId)) ?? null;
  }

  async listInactive(
    guildId: string,
    before: Date,
    limit: number,
  ): Promise<readonly MemberProfile[]> {
    return [...this.profiles.values()]
      .filter(
        (profile) =>
          profile.guildId === guildId &&
          profile.leftAt === null &&
          inactivityReference(profile).getTime() < before.getTime(),
      )
      .sort(
        (a, b) =>
          inactivityReference(a).getTime() - inactivityReference(b).getTime() ||
          a.memberId.localeCompare(b.memberId),
      )
      .slice(0, limit);
  }

  async listPresent(guildId: string): Promise<readonly MemberProfile[]> {
    return [...this.profiles.values()].filter(
      (profile) => profile.guildId === guildId && profile.leftAt === null,
    );
  }

  async listLeftBefore(
    before: Date,
  ): Promise<readonly { guildId: string; memberId: string }[]> {
    return [...this.profiles.values()]
      .filter((profile) => profile.leftAt !== null && profile.leftAt.getTime() < before.getTime())
      .map(({ guildId, memberId }) => ({ guildId, memberId }));
  }

  async delete(guildId: string, memberId: string): Promise<void> {
    this.profiles.delete(keyOf(guildId, memberId));
  }

  async purgeLeftBefore(before: Date): Promise<number> {
    let removed = 0;

    for (const [key, profile] of this.profiles) {
      if (profile.leftAt && profile.leftAt.getTime() < before.getTime()) {
        this.profiles.delete(key);
        removed += 1;
      }
    }

    return removed;
  }
}

function keyOf(guildId: string, memberId: string): string {
  return `${guildId}:${memberId}`;
}

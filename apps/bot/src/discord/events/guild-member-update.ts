import { Events } from "discord.js";

import type { HandlerContext } from "@/discord/handler-context.ts";
import { defineEvent } from "@/discord/events/types.ts";
import { logger } from "@/shared/logger.ts";
import { identityOf } from "@/discord/members/identity.ts";
import type { IdentityKind } from "@/domain/phaethon/phaethon-types.ts";

/** Un mute vient d'être posé ou levé : laisse au bot le temps de noter ses propres sanctions, puis aligne la base. */
async function syncMute(sanctions: HandlerContext["sanctionService"], guildId: string, memberId: string, until: number | null): Promise<void> {
  try {
    if (until === null || until <= Date.now()) {
      await sanctions.clear("mute", guildId, memberId, null);
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 2_500));
    await sanctions.recordUnknownIfAbsent("mute", guildId, memberId, "—", new Date(until));
  } catch (error) {
    logger.warn("Failed to sync a timeout", { guildId, error: error instanceof Error ? error.message : String(error) });
  }
}

const iso = (timestamp: number | null | undefined): string | null =>
  timestamp ? new Date(timestamp).toISOString() : null;

/** Pseudo, avatar du serveur, rôles, boost et timeout : chaque changement est daté. */
export const guildMemberUpdate = defineEvent({
  name: Events.GuildMemberUpdate,
  execute({ phaethonTracker, guildSync, memberService, sanctionService }: HandlerContext, oldMember, newMember) {
    // Des rôles qui changent peuvent donner ou retirer l'accès au panneau.
    if (oldMember.partial || !oldMember.roles.cache.equals(newMember.roles.cache)) {
      guildSync.schedule(newMember.guild);
    }

    // Une ancienne fiche partielle ne dit rien de l'état d'avant : on ne devine pas.
    if (newMember.user.bot || oldMember.partial) {
      return;
    }

    // Mute levé ou posé dans Discord : le panneau reste juste.
    const until = newMember.communicationDisabledUntilTimestamp;

    if (oldMember.communicationDisabledUntilTimestamp !== until) {
      void syncMute(sanctionService, newMember.guild.id, newMember.id, until);
    }

    if (oldMember.nickname !== newMember.nickname || oldMember.avatar !== newMember.avatar) {
      void memberService.setIdentity(newMember.guild.id, newMember.id, identityOf(newMember)).catch(() => undefined);
    }

    const at = new Date();
    const emit = (kind: IdentityKind, oldValue: string | null, newValue: string | null) =>
      phaethonTracker.recordIdentity({
        id: crypto.randomUUID(),
        guildId: newMember.guild.id,
        memberId: newMember.id,
        kind,
        oldValue,
        newValue,
        at,
      });

    if (oldMember.nickname !== newMember.nickname) {
      emit("nickname", oldMember.nickname, newMember.nickname);
    }

    if (oldMember.avatar !== newMember.avatar) {
      emit("avatar", oldMember.avatar, newMember.avatar);
    }

    const added = newMember.roles.cache.filter((role) => !oldMember.roles.cache.has(role.id));
    const removed = oldMember.roles.cache.filter((role) => !newMember.roles.cache.has(role.id));

    if (added.size > 0 || removed.size > 0) {
      emit(
        "roles",
        null,
        [...added.map((role) => `+${role.id}`), ...removed.map((role) => `-${role.id}`)].join(","),
      );
    }

    const boostBefore = iso(oldMember.premiumSinceTimestamp);
    const boostAfter = iso(newMember.premiumSinceTimestamp);

    if ((boostBefore === null) !== (boostAfter === null)) {
      emit("boost", boostBefore, boostAfter);
    }

    const timeoutBefore = iso(oldMember.communicationDisabledUntilTimestamp);
    const timeoutAfter = iso(newMember.communicationDisabledUntilTimestamp);

    if (timeoutBefore !== timeoutAfter && (timeoutBefore === null) !== (timeoutAfter === null)) {
      emit("timeout", timeoutBefore, timeoutAfter);
    }
  },
});

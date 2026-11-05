import { Events } from "discord.js";

import type { HandlerContext } from "@/discord/handler-context.ts";
import { defineEvent } from "@/discord/events/types.ts";
import type { IdentityKind } from "@/domain/phaethon/phaethon-types.ts";

const iso = (timestamp: number | null | undefined): string | null =>
  timestamp ? new Date(timestamp).toISOString() : null;

/** Pseudo, avatar du serveur, rôles, boost et timeout : chaque changement est daté. */
export const guildMemberUpdate = defineEvent({
  name: Events.GuildMemberUpdate,
  execute({ config, phaethonTracker }: HandlerContext, oldMember, newMember) {
    // Une ancienne fiche partielle ne dit rien de l'état d'avant : on ne devine pas.
    if (newMember.guild.id !== config.primaryGuildId || newMember.user.bot || oldMember.partial) {
      return;
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

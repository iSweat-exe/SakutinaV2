import { Events } from "discord.js";

import { defineEvent } from "@/discord/events/types.ts";
import { identityOf } from "@/discord/members/identity.ts";

/**
 * Les permissions d'un rôle décident qui peut gérer le serveur : la liste est recalculée. Un rôle renommé ou
 * déplacé change aussi ce que le panneau affiche de ses membres (Profiling).
 */
export const roleUpdate = defineEvent({
  name: Events.GuildRoleUpdate,
  execute({ guildSync, memberService }, oldRole, role) {
    guildSync.schedule(role.guild);

    if (oldRole.name === role.name && oldRole.position === role.position) {
      return;
    }

    for (const member of role.members.values()) {
      if (!member.user.bot) {
        void memberService.setIdentity(role.guild.id, member.id, identityOf(member)).catch(() => undefined);
      }
    }
  },
});

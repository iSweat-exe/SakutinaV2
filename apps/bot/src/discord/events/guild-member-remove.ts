import { Events } from "discord.js";

import { logger } from "@/shared/logger.ts";
import { defineEvent } from "@/discord/events/types.ts";

export const guildMemberRemove = defineEvent({
  name: Events.GuildMemberRemove,
  async execute({ activityTracker, memberService, guildSync }, member) {
    // Un gestionnaire qui part perd l'accès au panneau.
    guildSync.schedule(member.guild);

    // Une fiche partielle n'a pas toujours son utilisateur : on ne peut alors pas exclure les bots.
    if (member.user?.bot) {
      return;
    }

    const at = new Date();
    activityTracker.recordLeave(member.guild.id, member.id, at);

    try {
      await memberService.markLeft(member.guild.id, member.id, at);
    } catch (error) {
      logger.error("Failed to record member departure", {
        memberId: member.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
});

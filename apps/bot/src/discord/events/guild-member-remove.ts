import { Events } from "discord.js";

import { logger } from "@/shared/logger.ts";
import { defineEvent } from "@/discord/events/types.ts";

export const guildMemberRemove = defineEvent({
  name: Events.GuildMemberRemove,
  async execute({ config, activityTracker, memberService }, member) {
    // Une fiche partielle n'a pas toujours son utilisateur : on ne peut alors pas exclure les bots.
    if (member.guild.id !== config.primaryGuildId || member.user?.bot) {
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

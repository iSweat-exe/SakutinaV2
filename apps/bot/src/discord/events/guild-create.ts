import { Events } from "discord.js";

import { defineEvent } from "@/discord/events/types.ts";
import { logger } from "@/shared/logger.ts";

/** Le bot rejoint un serveur : sa fiche et ses gestionnaires sont écrits pour le panneau. */
export const guildCreate = defineEvent({
  name: Events.GuildCreate,
  async execute({ guildSync, memberService }, guild) {
    logger.info("Joined guild", { guildId: guild.id, members: guild.memberCount });

    try {
      // Remplit le cache des membres : la liste des gestionnaires en dépend.
      const members = await guild.members.fetch();
      await memberService.seed(
        guild.id,
        members.filter((member) => !member.user.bot).map((member) => ({ memberId: member.id, joinedAt: member.joinedAt })),
      );
    } catch (error) {
      logger.warn("Could not fetch members of the new guild", {
        guildId: guild.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    await guildSync.syncNow(guild);
  },
});

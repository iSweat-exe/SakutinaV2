import { Events } from "discord.js";

import { defineEvent } from "@/discord/events/types.ts";
import { logger } from "@/shared/logger.ts";

/** Un bannissement levé (par le bot, le panneau ou Discord) n'est plus actif. */
export const guildBanRemove = defineEvent({
  name: Events.GuildBanRemove,
  async execute({ sanctionService }, ban) {
    try {
      await sanctionService.clear("ban", ban.guild.id, ban.user.id, null);
    } catch (error) {
      logger.warn("Failed to close a lifted ban", {
        guildId: ban.guild.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
});

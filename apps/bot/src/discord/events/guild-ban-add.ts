import { Events } from "discord.js";

import { defineEvent } from "@/discord/events/types.ts";
import { logger } from "@/shared/logger.ts";

/** Laisse au bot le temps d'enregistrer ses propres sanctions avant de noter celles faites dans Discord. */
export const timing = { settleMs: 2_500 };

/** Un bannissement fait dans Discord (hors du bot) : le panneau doit le voir et pouvoir le lever. */
export const guildBanAdd = defineEvent({
  name: Events.GuildBanAdd,
  async execute({ sanctionService }, ban) {
    await new Promise((resolve) => setTimeout(resolve, timing.settleMs));

    try {
      await sanctionService.recordUnknownIfAbsent("ban", ban.guild.id, ban.user.id, ban.reason?.trim() || "—", null);
    } catch (error) {
      logger.warn("Failed to record a ban made in Discord", {
        guildId: ban.guild.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
});

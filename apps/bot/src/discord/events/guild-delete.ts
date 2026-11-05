import { Events } from "discord.js";

import { defineEvent } from "@/discord/events/types.ts";
import { logger } from "@/shared/logger.ts";

/** Le bot quitte un serveur (ou en est expulsé). Une panne Discord (`available === false`) n'est pas un départ. */
export const guildDelete = defineEvent({
  name: Events.GuildDelete,
  async execute({ guildSync }, guild) {
    if (!guild.available) {
      return;
    }

    logger.info("Left guild", { guildId: guild.id });
    await guildSync.remove(guild.id);
  },
});

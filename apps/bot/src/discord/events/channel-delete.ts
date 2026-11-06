import { Events } from "discord.js";

import { defineEvent } from "@/discord/events/types.ts";

/** Salon supprimé : il disparaît de la liste proposée dans le panneau. */
export const channelDelete = defineEvent({
  name: Events.ChannelDelete,
  execute({ guildSync }, channel) {
    if (!channel.isDMBased()) {
      guildSync.schedule(channel.guild);
    }
  },
});

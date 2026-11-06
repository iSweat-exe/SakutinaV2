import { Events } from "discord.js";

import { defineEvent } from "@/discord/events/types.ts";

/** Salon renommé, déplacé ou dont les permissions changent : la liste proposée dans le panneau est recalculée. */
export const channelUpdate = defineEvent({
  name: Events.ChannelUpdate,
  execute({ guildSync }, _oldChannel, channel) {
    if (!channel.isDMBased()) {
      guildSync.schedule(channel.guild);
    }
  },
});

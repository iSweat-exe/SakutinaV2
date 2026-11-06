import { Events } from "discord.js";

import { defineEvent } from "@/discord/events/types.ts";

/** Un nouveau salon peut recevoir les alertes : la liste proposée dans le panneau est recalculée. */
export const channelCreate = defineEvent({
  name: Events.ChannelCreate,
  execute({ guildSync }, channel) {
    guildSync.schedule(channel.guild);
  },
});

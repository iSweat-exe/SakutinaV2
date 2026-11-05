import { Events } from "discord.js";

import { defineEvent } from "@/discord/events/types.ts";

/** Nom, icône, bannière ou propriétaire du serveur changés. */
export const guildUpdate = defineEvent({
  name: Events.GuildUpdate,
  execute({ guildSync }, _oldGuild, newGuild) {
    guildSync.schedule(newGuild);
  },
});

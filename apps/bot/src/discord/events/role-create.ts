import { Events } from "discord.js";

import { defineEvent } from "@/discord/events/types.ts";

/** Les permissions d'un rôle décident qui peut gérer le serveur : la liste est recalculée. */
export const roleCreate = defineEvent({
  name: Events.GuildRoleCreate,
  execute({ guildSync }, role) {
    guildSync.schedule(role.guild);
  },
});

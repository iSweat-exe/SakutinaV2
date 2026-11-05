import { Events } from "discord.js";

import { defineEvent } from "@/discord/events/types.ts";

/** Les permissions d'un rôle décident qui peut gérer le serveur : la liste est recalculée. */
export const roleUpdate = defineEvent({
  name: Events.GuildRoleUpdate,
  execute({ guildSync }, _oldRole, role) {
    guildSync.schedule(role.guild);
  },
});

import { Events } from "discord.js";

import { defineEvent } from "@/discord/events/types.ts";

/** Nom d'utilisateur, nom affiché et avatar du compte (communs à tous les serveurs). */
export const userUpdate = defineEvent({
  name: Events.UserUpdate,
  execute({ phaethonTracker }, oldUser, newUser) {
    if (newUser.bot || oldUser.partial) {
      return;
    }

    // L'événement vaut pour tous les serveurs : il est daté dans chaque serveur du bot où le membre est présent.
    const guildIds = [...newUser.client.guilds.cache.values()]
      .filter((guild) => guild.members.cache.has(newUser.id))
      .map((guild) => guild.id);

    const at = new Date();
    const emit = (kind: "username" | "display-name" | "avatar", oldValue: string | null, newValue: string | null) => {
      for (const guildId of guildIds) {
        phaethonTracker.recordIdentity({
          id: crypto.randomUUID(),
          guildId,
          memberId: newUser.id,
          kind,
          oldValue,
          newValue,
          at,
        });
      }
    };

    if (oldUser.username !== newUser.username) {
      emit("username", oldUser.username, newUser.username);
    }

    if (oldUser.globalName !== newUser.globalName) {
      emit("display-name", oldUser.globalName, newUser.globalName);
    }

    if (oldUser.avatar !== newUser.avatar) {
      emit("avatar", oldUser.avatar, newUser.avatar);
    }
  },
});

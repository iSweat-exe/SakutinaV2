import { Events } from "discord.js";

import { defineEvent } from "@/discord/events/types.ts";
import { observePresence } from "@/discord/presence.ts";

/** Statut et activités : n'arrive que si l'intention privilégiée « Presence » est activée. */
export const presenceUpdate = defineEvent({
  name: Events.PresenceUpdate,
  execute({ config, presenceSessions }, _oldPresence, newPresence) {
    const guild = newPresence.guild;

    if (!guild || newPresence.user?.bot || !config.trackPresence) {
      return;
    }

    presenceSessions.observe(
      guild.id,
      newPresence.userId,
      observePresence(newPresence),
      new Date(),
    );
  },
});

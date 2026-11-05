import { Events } from "discord.js";

import { defineEvent } from "@/discord/events/types.ts";
import { observePresence } from "@/discord/presence.ts";

/** Statut et activités : n'arrive que si l'intention privilégiée « Presence » est activée. */
export const presenceUpdate = defineEvent({
  name: Events.PresenceUpdate,
  execute({ config, presenceSessions }, _oldPresence, newPresence) {
    if (
      newPresence.guild?.id !== config.primaryGuildId ||
      newPresence.user?.bot ||
      !config.trackPresence
    ) {
      return;
    }

    presenceSessions.observe(
      newPresence.guild.id,
      newPresence.userId,
      observePresence(newPresence),
      new Date(),
    );
  },
});

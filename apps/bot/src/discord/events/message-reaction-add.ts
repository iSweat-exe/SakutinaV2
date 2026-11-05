import { Events } from "discord.js";

import { defineEvent } from "@/discord/events/types.ts";

export const messageReactionAdd = defineEvent({
  name: Events.MessageReactionAdd,
  async execute({ activityTracker, phaethonTracker }, reaction, user) {
    const guildId = reaction.message.guildId;

    if (user.bot || !guildId) {
      return;
    }

    const at = new Date();
    activityTracker.recordReactionGiven(guildId, user.id, at);

    // L'auteur d'un message hors cache n'est connu qu'après récupération du message.
    const message = reaction.message.partial
      ? await reaction.message.fetch().catch(() => null)
      : reaction.message;
    const author = message?.author;

    if (author && !author.bot && author.id !== user.id) {
      activityTracker.recordReactionReceived(guildId, author.id, at);
      phaethonTracker.recordInteraction(guildId, user.id, author.id, at, { reactions: 1 });
    }
  },
});

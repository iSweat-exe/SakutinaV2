import { Events } from "discord.js";

import { defineEvent } from "@/discord/events/types.ts";

export const messageReactionAdd = defineEvent({
  name: Events.MessageReactionAdd,
  async execute({ config, activityTracker, phaethonTracker }, reaction, user) {
    if (user.bot || reaction.message.guildId !== config.primaryGuildId) {
      return;
    }

    const at = new Date();
    activityTracker.recordReactionGiven(config.primaryGuildId, user.id, at);

    // L'auteur d'un message hors cache n'est connu qu'après récupération du message.
    const message = reaction.message.partial
      ? await reaction.message.fetch().catch(() => null)
      : reaction.message;
    const author = message?.author;

    if (author && !author.bot && author.id !== user.id) {
      activityTracker.recordReactionReceived(config.primaryGuildId, author.id, at);
      phaethonTracker.recordInteraction(config.primaryGuildId, user.id, author.id, at, { reactions: 1 });
    }
  },
});

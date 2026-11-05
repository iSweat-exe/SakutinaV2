import { Events, MessageType } from "discord.js";

import { defineEvent } from "@/discord/events/types.ts";

export const messageCreate = defineEvent({
  name: Events.MessageCreate,
  execute({ config, activityTracker }, message) {
    if (message.author.bot || message.guildId !== config.primaryGuildId) {
      return;
    }

    // Seuls des nombres sont retenus : le contenu du message n'est jamais conservé.
    activityTracker.recordMessage(
      message.guildId,
      message.author.id,
      message.channelId,
      message.createdAt,
      {
        characters: message.content.length,
        isReply: message.type === MessageType.Reply,
        attachments: message.attachments.size,
        mentions: message.mentions.users.size,
      },
    );
  },
});

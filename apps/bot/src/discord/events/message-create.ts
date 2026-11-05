import { Events, MessageType, type Message, type User } from "discord.js";

import { enforceAutomod } from "@/discord/automod/enforce.ts";
import { defineEvent } from "@/discord/events/types.ts";
import { logger } from "@/shared/logger.ts";

/** Auteur du message auquel celui-ci répond : la mention de réponse, sinon le cache (jamais d'appel réseau). */
function repliedAuthor(message: Message): User | null {
  if (message.type !== MessageType.Reply) {
    return null;
  }

  const cached = message.reference?.messageId
    ? message.channel.messages.cache.get(message.reference.messageId)?.author
    : undefined;

  return message.mentions.repliedUser ?? cached ?? null;
}

export const messageCreate = defineEvent({
  name: Events.MessageCreate,
  async execute(context, message) {
    const { activityTracker, phaethonTracker } = context;

    // Messages privés exclus : seuls les serveurs sont suivis.
    if (message.author.bot || !message.inGuild()) {
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

    // Phaéthon : à quelle heure le membre écrit, et à qui il s'adresse (des identifiants, pas des mots).
    phaethonTracker.recordMessageHour(message.guildId, message.author.id, message.createdAt);

    const replied = repliedAuthor(message);

    if (replied && !replied.bot) {
      phaethonTracker.recordInteraction(message.guildId, message.author.id, replied.id, message.createdAt, {
        replies: 1,
      });
    }

    for (const mentioned of message.mentions.users.values()) {
      // La mention automatique d'une réponse est déjà comptée comme réponse.
      if (!mentioned.bot && mentioned.id !== replied?.id) {
        phaethonTracker.recordInteraction(message.guildId, message.author.id, mentioned.id, message.createdAt, {
          mentions: 1,
        });
      }
    }

    // Auto-modération du serveur : supprime le message et, selon la règle, réduit son auteur au silence.
    await enforceAutomod(context, message).catch((error: unknown) => {
      logger.error("Automod failed", { error: error instanceof Error ? error.message : String(error) });
    });
  },
});

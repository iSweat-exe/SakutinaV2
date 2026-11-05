import { Client, GatewayIntentBits, Partials } from "discord.js";

export type ClientOptions = Readonly<{
  /** Ajoute l'intention privilégiée « Presence » (statut, jeux). */
  trackPresence: boolean;
}>;

export function createDiscordClient({ trackPresence }: ClientOptions = { trackPresence: false }): Client {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildVoiceStates,
      ...(trackPresence ? [GatewayIntentBits.GuildPresences] : []),
    ],
    // Les réactions sur des messages hors cache arrivent en version partielle.
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
  });
}

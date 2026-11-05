import { Client, GatewayIntentBits, Partials } from "discord.js";

export function createDiscordClient(): Client {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildVoiceStates,
    ],
    // Les réactions sur des messages hors cache arrivent en version partielle.
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
  });
}

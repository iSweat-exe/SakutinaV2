import { SlashCommandSubcommandBuilder } from "discord.js";

import type { Command } from "@/discord/commands/command.ts";
import { messages } from "@/discord/messages.ts";
import { createPanel } from "@/discord/ui/panels.ts";
import { respondPrivately } from "@/discord/ui/replies.ts";

export const pingCommand: Command = {
  definition: new SlashCommandSubcommandBuilder()
    .setName("ping")
    .setDescription(messages.general.ping.description)
    .toJSON(),
  requiredRole: "member",
  async execute(interaction) {
    const text = messages.general.ping;
    // Latence de l'API : délai entre la création de l'interaction et son traitement.
    const api = Math.max(0, Date.now() - interaction.createdTimestamp);
    const websocket = interaction.client.ws.ping;

    await respondPrivately(
      interaction,
      createPanel({
        category: "general",
        title: text.title,
        fields: [
          { name: text.api, value: `${api} ms` },
          {
            name: text.websocket,
            value: websocket >= 0 ? `${Math.round(websocket)} ms` : text.unavailable,
          },
        ],
      }),
    );
  },
};

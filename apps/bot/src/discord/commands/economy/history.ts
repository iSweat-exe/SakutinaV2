import { guildIdOf } from "@/discord/guild.ts";
import { SlashCommandSubcommandBuilder } from "discord.js";

import type { Command } from "@/discord/commands/command.ts";
import { buildHistoryPanel } from "@/discord/commands/economy/history-panel.ts";
import { messages } from "@/discord/messages.ts";
import { respondPrivately } from "@/discord/ui/replies.ts";

/** Historique paginé : les boutons « Précédent » et « Suivant » changent de page sur place. */
export const historyCommand: Command = {
  definition: new SlashCommandSubcommandBuilder()
    .setName("history")
    .setDescription(messages.economy.history.description)
    .toJSON(),
  requiredRole: "member",
  async execute(interaction, context) {
    await respondPrivately(interaction, await buildHistoryPanel(context, guildIdOf(interaction), interaction.user.id, 1));
  },
};

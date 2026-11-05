import { SlashCommandSubcommandBuilder } from "discord.js";

import type { Command } from "@/discord/commands/command.ts";
import { buildForgetDialog } from "@/discord/commands/tracking/forget-panel.ts";
import { messages } from "@/discord/messages.ts";
import { respondPrivately } from "@/discord/ui/replies.ts";

/**
 * Droit à l'effacement : chacun peut supprimer ses propres données de suivi,
 * après une confirmation à deux boutons. L'économie (jeu) et le journal d'audit
 * (sécurité, purgé à 30 jours) sont conservés.
 */
export const forgetMeCommand: Command = {
  definition: new SlashCommandSubcommandBuilder()
    .setName("forget")
    .setDescription(messages.tracking.forget.description)
    .toJSON(),
  requiredRole: "member",
  async execute(interaction) {
    await respondPrivately(interaction, buildForgetDialog(interaction.user.id));
  },
};

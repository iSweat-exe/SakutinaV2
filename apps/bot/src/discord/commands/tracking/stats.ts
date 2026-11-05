import { SlashCommandBuilder } from "discord.js";

import type { Command } from "@/discord/commands/command.ts";
import { loadStats } from "@/discord/commands/tracking/stats-panel.ts";
import { messages } from "@/discord/messages.ts";
import { errorPanel } from "@/discord/ui/panels.ts";
import { respond, respondPrivately } from "@/discord/ui/replies.ts";
import { RETENTION_DAYS } from "@/domain/activity/activity-service.ts";

/**
 * Chacun voit ses propres statistiques ; celles d'un autre membre sont
 * réservées aux administrateurs. Seuls des compteurs sont affichés : le bot ne
 * conserve jamais le contenu des messages. Les boutons changent de période.
 */
export const statsCommand: Command = {
  definition: new SlashCommandBuilder()
    .setName("stats")
    .setDescription(messages.tracking.stats.description)
    .addUserOption((option) =>
      option
        .setName("member")
        .setDescription(messages.tracking.memberOption)
        .setRequired(false),
    )
    .addIntegerOption((option) =>
      option
        .setName("days")
        .setDescription(messages.tracking.daysOption)
        .setMinValue(1)
        .setMaxValue(RETENTION_DAYS)
        .setRequired(false),
    )
    .toJSON(),
  requiredRole: "member",
  async execute(interaction, context, invoker) {
    const target = interaction.options.getUser("member") ?? interaction.user;
    const days = interaction.options.getInteger("days") ?? RETENTION_DAYS;
    const result = await loadStats(context, invoker.role, interaction.user.id, target, days);

    if (result.denied) {
      await respondPrivately(
        interaction,
        errorPanel({
          category: "tracking",
          title: messages.errors.adminOnlyTitle,
          description: messages.errors.adminOnly,
        }),
      );
      return;
    }

    await respond(interaction, result.panel, { ephemeral: true });
  },
};

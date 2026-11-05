import { SlashCommandSubcommandBuilder } from "discord.js";

import type { Command } from "@/discord/commands/command.ts";
import {
  DEFAULT_PERIOD,
  buildLeaderboard,
  isLeaderboardCategory,
} from "@/discord/commands/tracking/leaderboard-panel.ts";
import { messages } from "@/discord/messages.ts";
import { errorPanel } from "@/discord/ui/panels.ts";
import { respond, respondPrivately } from "@/discord/ui/replies.ts";

/** Classement interactif : le menu change de classement, les boutons changent de période. */
export const leaderboardCommand: Command = {
  definition: new SlashCommandSubcommandBuilder()
    .setName("leaderboard")
    .setDescription(messages.tracking.leaderboard.description)
    .addStringOption((option) =>
      option
        .setName("category")
        .setDescription(messages.tracking.leaderboard.categoryOption)
        .setRequired(true)
        .addChoices(
          { name: messages.tracking.leaderboard.categories.economy, value: "economy" },
          { name: messages.tracking.leaderboard.categories.messages, value: "messages" },
          { name: messages.tracking.leaderboard.categories.voice, value: "voice" },
          { name: messages.tracking.leaderboard.categories.reactions, value: "reactions" },
        ),
    )
    .addIntegerOption((option) =>
      option
        .setName("days")
        .setDescription(messages.tracking.daysOption)
        .setMinValue(1)
        .setMaxValue(30)
        .setRequired(false),
    )
    .toJSON(),
  requiredRole: "member",
  async execute(interaction, context, invoker) {
    const category = interaction.options.getString("category", true);
    const days = interaction.options.getInteger("days") ?? DEFAULT_PERIOD;

    if (!isLeaderboardCategory(category)) {
      return;
    }

    const result = await buildLeaderboard(context, invoker.role, interaction.user.id, category, days);

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

    await respond(interaction, result.panel, { ephemeral: result.private });
  },
};

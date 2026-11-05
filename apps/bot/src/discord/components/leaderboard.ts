import { guildIdOf } from "@/discord/guild.ts";
import { MessageFlags } from "discord.js";

import type { ComponentHandler } from "@/discord/components/handler.ts";
import {
  DEFAULT_PERIOD,
  buildLeaderboard,
  isLeaderboardCategory,
  isPrivateCategory,
} from "@/discord/commands/tracking/leaderboard-panel.ts";
import { messages } from "@/discord/messages.ts";
import { errorPanel } from "@/discord/ui/panels.ts";
import { respond, respondPrivately, update } from "@/discord/ui/replies.ts";

/** Menu de catégorie et boutons de période du classement. */
export const leaderboardComponents: ComponentHandler = {
  namespace: "lb",
  async handle(interaction, context, id, invoker) {
    if (interaction.isModalSubmit()) {
      return;
    }

    const category = interaction.isStringSelectMenu()
      ? interaction.values[0]
      : id.args[0];
    const days = interaction.isButton() ? Number(id.args[1]) : DEFAULT_PERIOD;

    if (!category || !isLeaderboardCategory(category) || !Number.isInteger(days)) {
      return;
    }

    const result = await buildLeaderboard(context, guildIdOf(interaction), invoker.role, id.ownerId, category, days);

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

    // Un message public ne doit jamais « devenir » un classement d'activité : on répond alors en privé.
    const messageIsPrivate = interaction.message.flags.has(MessageFlags.Ephemeral);

    if (isPrivateCategory(category) && !messageIsPrivate) {
      await respond(interaction, result.panel, { ephemeral: true });
      return;
    }

    await update(interaction, result.panel);
  },
};

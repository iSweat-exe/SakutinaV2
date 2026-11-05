import { SlashCommandSubcommandBuilder } from "discord.js";

import type { Command } from "@/discord/commands/command.ts";
import { loadStats } from "@/discord/commands/tracking/stats-panel.ts";
import { messages } from "@/discord/messages.ts";
import { respond } from "@/discord/ui/replies.ts";
import { RETENTION_DAYS } from "@/domain/activity/activity-service.ts";

/** Activité détaillée d'un membre, réservée aux administrateurs (même présentation que `/me stats`). */
export const activityCommand: Command = {
  definition: new SlashCommandSubcommandBuilder()
    .setName("activity")
    .setDescription(messages.admin.activity.description)
    .addUserOption((option) =>
      option
        .setName("member")
        .setDescription(messages.admin.activity.memberOption)
        .setRequired(false),
    )
    .toJSON(),
  requiredRole: "admin",
  async execute(interaction, context, invoker) {
    const target = interaction.options.getUser("member") ?? interaction.user;
    const result = await loadStats(
      context,
      invoker.role,
      interaction.user.id,
      target,
      RETENTION_DAYS,
    );

    if (!result.denied) {
      await respond(interaction, result.panel, { ephemeral: true });
    }
  },
};

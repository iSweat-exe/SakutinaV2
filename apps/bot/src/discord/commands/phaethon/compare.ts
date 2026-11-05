import { guildIdOf } from "@/discord/guild.ts";
import { SlashCommandSubcommandBuilder } from "discord.js";

import type { Command } from "@/discord/commands/command.ts";
import { buildComparePanel } from "@/discord/commands/phaethon/compare-panel.ts";
import { recordAudit } from "@/discord/audit.ts";
import { messages } from "@/discord/messages.ts";
import { respondPrivately } from "@/discord/ui/replies.ts";

const text = messages.phaethon.compare;

/** Deux membres côte à côte : activité, échanges entre eux, contacts et jeux en commun. */
export const compareCommand: Command = {
  definition: new SlashCommandSubcommandBuilder()
    .setName("compare")
    .setDescription(text.description)
    .addUserOption((option) =>
      option.setName("member_a").setDescription(text.leftOption).setRequired(true),
    )
    .addUserOption((option) =>
      option.setName("member_b").setDescription(text.rightOption).setRequired(true),
    )
    .toJSON(),
  requiredRole: "admin",
  async execute(interaction, context) {
    const left = interaction.options.getUser("member_a", true);
    const right = interaction.options.getUser("member_b", true);
    const comparison = await context.phaethonService.compare(guildIdOf(interaction), left.id, right.id);

    await recordAudit(context, guildIdOf(interaction), "profile.compared", interaction.user.id, left.id, {
      other: right.id,
    });
    await respondPrivately(interaction, buildComparePanel(comparison));
  },
};

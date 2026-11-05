import { guildIdOf } from "@/discord/guild.ts";
import { SlashCommandSubcommandBuilder } from "discord.js";

import { recordAudit } from "@/discord/audit.ts";
import type { Command } from "@/discord/commands/command.ts";
import { done } from "@/discord/commands/moderation/shared.ts";
import { messages } from "@/discord/messages.ts";
import { errorPanel } from "@/discord/ui/panels.ts";
import { respondPrivately } from "@/discord/ui/replies.ts";

const text = messages.moderation;

export const unwarnCommand: Command = {
  definition: new SlashCommandSubcommandBuilder()
    .setName("unwarn")
    .setDescription(text.unwarn.description)
    .addIntegerOption((option) =>
      option.setName("id").setDescription(text.unwarn.idOption).setRequired(true).setMinValue(1),
    )
    .toJSON(),
  requiredRole: "admin",
  async execute(interaction, context) {
    const id = interaction.options.getInteger("id", true);
    const removed = await context.moderationService.remove(guildIdOf(interaction), id);

    await recordAudit(context, guildIdOf(interaction), "moderation.unwarn", interaction.user.id, null, {
      warningId: id,
      result: removed ? "ok" : "refused:missing",
    });
    await respondPrivately(
      interaction,
      removed
        ? done(text.unwarn.title, text.unwarn.text(id))
        : errorPanel({ category: "admin", title: text.unwarn.missingTitle, description: text.unwarn.missing }),
    );
  },
};

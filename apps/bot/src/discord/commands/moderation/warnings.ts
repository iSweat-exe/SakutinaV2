import { SlashCommandSubcommandBuilder } from "discord.js";

import type { Command } from "@/discord/commands/command.ts";
import { discordTime, plain } from "@/discord/formatting.ts";
import { messages } from "@/discord/messages.ts";
import { createPanel } from "@/discord/ui/panels.ts";
import { respondPrivately } from "@/discord/ui/replies.ts";
import { MAX_REASON_LENGTH } from "@/domain/moderation/moderation-rules.ts";

const text = messages.moderation;

export const warningsCommand: Command = {
  definition: new SlashCommandSubcommandBuilder()
    .setName("warnings")
    .setDescription(text.warnings.description)
    .addUserOption((option) => option.setName("member").setDescription(text.memberOption).setRequired(true))
    .toJSON(),
  requiredRole: "moderator",
  async execute(interaction, { config, moderationService }) {
    const user = interaction.options.getUser("member", true);
    const { total, latest } = await moderationService.warnings(config.primaryGuildId, user.id);

    await respondPrivately(
      interaction,
      createPanel({
        category: "admin",
        title: text.warnings.title,
        description: latest.length
          ? latest
              .map((warning) =>
                text.warnings.line(
                  warning.id,
                  discordTime(warning.createdAt),
                  `<@${warning.moderatorId}>`,
                  plain(warning.reason, MAX_REASON_LENGTH),
                ),
              )
              .join("\n")
          : text.warnings.empty,
        footer: `<@${user.id}> · ${text.warnings.total(total, latest.length)}`,
      }),
    );
  },
};

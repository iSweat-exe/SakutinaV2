import { guildIdOf } from "@/discord/guild.ts";
import { SlashCommandSubcommandBuilder } from "discord.js";

import { recordAudit } from "@/discord/audit.ts";
import type { Command } from "@/discord/commands/command.ts";
import { auditReason, done } from "@/discord/commands/moderation/shared.ts";
import { messages } from "@/discord/messages.ts";
import { errorPanel } from "@/discord/ui/panels.ts";
import { respondPrivately } from "@/discord/ui/replies.ts";
import { MAX_REASON_LENGTH } from "@/domain/moderation/moderation-rules.ts";
import { logger } from "@/shared/logger.ts";

const text = messages.moderation;

export const unbanCommand: Command = {
  definition: new SlashCommandSubcommandBuilder()
    .setName("unban")
    .setDescription(text.unban.description)
    .addStringOption((option) =>
      option.setName("user_id").setDescription(text.unban.userIdOption).setRequired(true).setMaxLength(20),
    )
    .addStringOption((option) =>
      option.setName("reason").setDescription(text.reasonOption).setMaxLength(MAX_REASON_LENGTH),
    )
    .toJSON(),
  requiredRole: "admin",
  async execute(interaction, context) {
    const userId = interaction.options.getString("user_id", true).trim();
    const reason = (interaction.options.getString("reason") ?? "").trim() || "—";

    if (!/^\d{17,20}$/.test(userId)) {
      await respondPrivately(
        interaction,
        errorPanel({ category: "admin", title: text.unban.invalidTitle, description: text.unban.invalid }),
      );
      return;
    }

    try {
      await interaction.guild?.bans.remove(userId, auditReason(interaction, reason));
    } catch (error) {
      logger.warn("Unban failed", { error: error instanceof Error ? error.message : String(error) });
      await recordAudit(context, guildIdOf(interaction), "moderation.unban", interaction.user.id, userId, { reason, result: "failed" });
      await respondPrivately(
        interaction,
        errorPanel({ category: "admin", title: text.failedTitle, description: text.failed }),
      );
      return;
    }

    await recordAudit(context, guildIdOf(interaction), "moderation.unban", interaction.user.id, userId, { reason, result: "ok" });
    await respondPrivately(interaction, done(text.unban.title, text.unban.text(userId)));
  },
};

import { guildIdOf } from "@/discord/guild.ts";
import { SlashCommandSubcommandBuilder } from "discord.js";

import { recordAudit } from "@/discord/audit.ts";
import type { Command } from "@/discord/commands/command.ts";
import { done } from "@/discord/commands/moderation/shared.ts";
import { messages } from "@/discord/messages.ts";
import { errorPanel } from "@/discord/ui/panels.ts";
import { respondPrivately } from "@/discord/ui/replies.ts";
import { logger } from "@/shared/logger.ts";

const text = messages.moderation;
/** Discord refuse la suppression en masse de messages de plus de 14 jours. */
const BULK_DELETE_MAX_AGE_MS = 14 * 86_400_000;
const FETCH_LIMIT = 100;

/**
 * Supprime les derniers messages du salon (éventuellement ceux d'un seul membre).
 * Les messages sont lus pour être supprimés, jamais conservés.
 */
export const purgeCommand: Command = {
  definition: new SlashCommandSubcommandBuilder()
    .setName("purge")
    .setDescription(text.purge.description)
    .addIntegerOption((option) =>
      option.setName("count").setDescription(text.purge.countOption).setRequired(true).setMinValue(1).setMaxValue(100),
    )
    .addUserOption((option) => option.setName("member").setDescription(text.purge.memberOption))
    .toJSON(),
  requiredRole: "moderator",
  async execute(interaction, context) {
    const channel = interaction.channel;
    const count = interaction.options.getInteger("count", true);
    const target = interaction.options.getUser("member");

    if (!channel || channel.isDMBased() || !("bulkDelete" in channel)) {
      await respondPrivately(
        interaction,
        errorPanel({ category: "admin", title: text.purge.unavailableTitle, description: text.purge.unavailable }),
      );
      return;
    }

    const audit = (result: string, deleted = 0) =>
      recordAudit(context, guildIdOf(interaction), "moderation.purge", interaction.user.id, target?.id ?? null, {
        channelId: channel.id,
        requested: count,
        deleted,
        result,
      });

    try {
      const recent = await channel.messages.fetch({ limit: FETCH_LIMIT });
      const oldest = Date.now() - BULK_DELETE_MAX_AGE_MS;
      const doomed = [...recent.values()]
        .filter((message) => message.createdTimestamp > oldest && (!target || message.author.id === target.id))
        .slice(0, count);
      const deleted = doomed.length ? await channel.bulkDelete(doomed, true) : { size: 0 };

      await audit("ok", deleted.size);
      await respondPrivately(
        interaction,
        deleted.size > 0
          ? done(text.purge.title, text.purge.text(deleted.size))
          : errorPanel({ category: "admin", title: text.purge.title, description: text.purge.none }),
      );
    } catch (error) {
      logger.warn("Purge failed", { error: error instanceof Error ? error.message : String(error) });
      await audit("failed");
      await respondPrivately(
        interaction,
        errorPanel({ category: "admin", title: text.failedTitle, description: text.failed }),
      );
    }
  },
};

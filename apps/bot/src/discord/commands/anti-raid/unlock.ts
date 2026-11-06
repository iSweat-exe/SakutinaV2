import { MessageFlags, SlashCommandSubcommandBuilder } from "discord.js";

import type { Command } from "@/discord/commands/command.ts";
import { formatDuration } from "@/discord/formatting.ts";
import { messages } from "@/discord/messages.ts";
import { infoPanel, successPanel, warningPanel } from "@/discord/ui/panels.ts";
import { respondPrivately } from "@/discord/ui/replies.ts";

/** `/server unlock` : lève le raid en cours, qu'il ait été déclaré par la rafale ou à la main, et rétablit tout. */
export const unlockCommand: Command = {
  definition: new SlashCommandSubcommandBuilder()
    .setName("unlock")
    .setDescription(messages.antiRaid.unlock.description)
    .toJSON(),
  requiredRole: "admin",
  async execute(interaction, { raidGuard }) {
    const text = messages.antiRaid;
    const guild = interaction.guild;

    if (!guild) {
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const result = await raidGuard.unlock(guild, interaction.user.id);

    if (!result) {
      await respondPrivately(interaction, infoPanel({ category: "admin", title: text.unlock.title, description: text.unlock.none }));
      return;
    }

    const { raid, restore } = result;
    const panel = restore.failed > 0 ? warningPanel : successPanel;

    await respondPrivately(
      interaction,
      panel({
        category: "admin",
        title: text.unlock.title,
        description: restore.failed > 0 ? `${text.unlock.body}\n${text.notRestored(restore.failed)}` : text.unlock.body,
        fields: [
          { name: text.fields.duration, value: formatDuration((raid.endedAt ?? new Date()).getTime() - raid.startedAt.getTime()) },
          { name: text.fields.joins, value: String(raid.joins) },
          { name: text.fields.actioned, value: String(raid.actioned) },
          { name: text.fields.channels, value: text.restoredChannels(restore.restored) },
        ],
      }),
    );
  },
};

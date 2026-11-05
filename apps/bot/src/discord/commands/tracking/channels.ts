import { guildIdOf } from "@/discord/guild.ts";
import { SlashCommandSubcommandBuilder } from "discord.js";

import type { Command } from "@/discord/commands/command.ts";
import { formatNumber, formatVoiceTime } from "@/discord/formatting.ts";
import { messages } from "@/discord/messages.ts";
import { ranking } from "@/discord/ui/blocks.ts";
import { createPanel } from "@/discord/ui/panels.ts";
import { respondPrivately } from "@/discord/ui/replies.ts";
import type { ChannelTotal } from "@/domain/activity/activity-types.ts";

const LIMIT = 10;

function list(totals: readonly ChannelTotal[], format: (value: number) => string): string {
  return totals.length
    ? ranking(totals.map((total) => `<#${total.channelId}> — **${format(total.value)}**`))
    : messages.tracking.channels.empty;
}

export const channelsCommand: Command = {
  definition: new SlashCommandSubcommandBuilder()
    .setName("channels")
    .setDescription(messages.tracking.channels.description)
    .addIntegerOption((option) =>
      option
        .setName("days")
        .setDescription(messages.tracking.daysOption)
        .setMinValue(1)
        .setMaxValue(30)
        .setRequired(false),
    )
    .toJSON(),
  requiredRole: "admin",
  async execute(interaction, { config, activityService }) {
    const days = interaction.options.getInteger("days") ?? 7;
    const [byMessages, byVoice] = await Promise.all([
      activityService.topChannels(guildIdOf(interaction), "messages", days, LIMIT),
      activityService.topChannels(guildIdOf(interaction), "voiceSeconds", days, LIMIT),
    ]);
    const text = messages.tracking.channels;

    await respondPrivately(
      interaction,
      createPanel({
        category: "tracking",
        title: text.title(days),
        fields: [
          { name: text.messages, value: list(byMessages, formatNumber) },
          { name: text.voice, value: list(byVoice, formatVoiceTime) },
        ],
        timestamp: true,
      }),
    );
  },
};

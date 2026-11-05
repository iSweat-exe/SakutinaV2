import { SlashCommandBuilder } from "discord.js";

import type { Command } from "@/discord/commands/command.ts";
import { formatBar, formatNumber, formatVoiceTime } from "@/discord/formatting.ts";
import { messages } from "@/discord/messages.ts";
import { codeBlock, stat, statLine } from "@/discord/ui/blocks.ts";
import { createPanel } from "@/discord/ui/panels.ts";
import { respondPrivately } from "@/discord/ui/replies.ts";

const BUSIEST_HOURS = 3;

export const serverStatsCommand: Command = {
  definition: new SlashCommandBuilder()
    .setName("serverstats")
    .setDescription(messages.tracking.serverStats.description)
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
    const [{ totals, activeMembers }, hourly] = await Promise.all([
      activityService.serverTotals(config.primaryGuildId, days),
      activityService.hourlyMessages(config.primaryGuildId, days),
    ]);
    const text = messages.tracking.serverStats;
    const stats = messages.tracking.stats;
    const peak = Math.max(...hourly);
    const busiest = hourly
      .map((count, hour) => ({ count, hour }))
      .filter(({ count }) => count > 0)
      .sort((a, b) => b.count - a.count || a.hour - b.hour)
      .slice(0, BUSIEST_HOURS)
      .map(({ hour }) => `${String(hour).padStart(2, "0")} h`);
    const hour = (count: number, index: number) =>
      `${String(index).padStart(2, "0")} h ${formatBar(count, peak).padEnd(12)} ${count}`;

    await respondPrivately(
      interaction,
      createPanel({
        category: "tracking",
        title: text.title(days),
        fields: [
          { name: text.activeMembers, value: stat(formatNumber(activeMembers), "membres actifs") },
          {
            name: stats.sections.writing,
            value: statLine(
              stat(formatNumber(totals.messages), stats.messages),
              stat(formatNumber(totals.attachments), stats.attachments),
              stat(formatNumber(totals.reactionsGiven), stats.given),
            ),
          },
          { name: stats.sections.voice, value: `**${formatVoiceTime(totals.voiceSeconds)}**` },
          {
            name: stats.sections.server,
            value: statLine(
              stat(totals.joins, stats.joins),
              stat(totals.leaves, stats.leaves),
              stat(totals.attributedInvites, stats.invites),
            ),
          },
          ...(busiest.length ? [{ name: text.busiest, value: `**${busiest.join("  ·  ")}**` }] : []),
          { name: text.hourly, value: codeBlock(hourly.map(hour)) },
        ],
        timestamp: true,
      }),
    );
  },
};

import { guildIdOf } from "@/discord/guild.ts";
import { SlashCommandSubcommandBuilder } from "discord.js";

import type { Command } from "@/discord/commands/command.ts";
import { discordTime } from "@/discord/formatting.ts";
import { messages } from "@/discord/messages.ts";
import { createPanel } from "@/discord/ui/panels.ts";
import { respondPrivately } from "@/discord/ui/replies.ts";

const LIMIT = 20;

export const inactiveCommand: Command = {
  definition: new SlashCommandSubcommandBuilder()
    .setName("inactive")
    .setDescription(messages.tracking.inactive.description)
    .addIntegerOption((option) =>
      option
        .setName("days")
        .setDescription(messages.tracking.inactiveDaysOption)
        .setMinValue(1)
        .setMaxValue(365)
        .setRequired(false),
    )
    .toJSON(),
  requiredRole: "admin",
  async execute(interaction, { config, memberService }) {
    const days = interaction.options.getInteger("days") ?? 14;
    const profiles = await memberService.inactive(guildIdOf(interaction), days, LIMIT);
    const text = messages.tracking.inactive;

    await respondPrivately(
      interaction,
      createPanel({
        category: "tracking",
        title: text.title(days),
        description: profiles.length
          ? profiles
              .map((profile) =>
                profile.lastActiveAt
                  ? `<@${profile.memberId}> — ${discordTime(profile.lastActiveAt, "R")}`
                  : `<@${profile.memberId}> — ${text.never} ${discordTime(profile.firstSeenAt, "R")}`,
              )
              .join("\n")
          : text.empty,
        footer: `${text.count(profiles.length)} · ${text.note}`,
        timestamp: true,
      }),
    );
  },
};

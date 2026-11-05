import { SlashCommandBuilder } from "discord.js";

import type { Command } from "@/discord/commands/command.ts";
import { discordTime, formatNumber } from "@/discord/formatting.ts";
import { messages } from "@/discord/messages.ts";
import { errorPanel, createPanel } from "@/discord/ui/panels.ts";
import { respond, respondPrivately } from "@/discord/ui/replies.ts";

export const serverInfoCommand: Command = {
  definition: new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription(messages.general.serverInfo.description)
    .toJSON(),
  requiredRole: "member",
  async execute(interaction) {
    const guild = interaction.guild;

    if (!guild) {
      await respondPrivately(
        interaction,
        errorPanel({
          category: "general",
          title: messages.errors.wrongGuildTitle,
          description: messages.errors.wrongGuild,
        }),
      );
      return;
    }

    const text = messages.general.serverInfo;
    const icon = guild.iconURL({ size: 256 });

    await respond(
      interaction,
      createPanel({
        category: "general",
        title: guild.name,
        description: guild.description ?? undefined,
        ...(icon ? { thumbnail: icon } : {}),
        fields: [
          { name: text.owner, value: `<@${guild.ownerId}>` },
          { name: text.members, value: formatNumber(guild.memberCount) },
          { name: text.channels, value: formatNumber(guild.channels.cache.size) },
          { name: text.roles, value: formatNumber(guild.roles.cache.size) },
          {
            name: text.boosts,
            value: text.boostValue(guild.premiumSubscriptionCount ?? 0, guild.premiumTier),
          },
          { name: text.created, value: discordTime(guild.createdAt) },
        ],
        timestamp: true,
      }),
    );
  },
};

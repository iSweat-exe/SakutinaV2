import { SlashCommandBuilder } from "discord.js";

import type { Command } from "@/discord/commands/command.ts";
import { discordTime } from "@/discord/formatting.ts";
import { messages } from "@/discord/messages.ts";
import { createPanel } from "@/discord/ui/panels.ts";
import { respond } from "@/discord/ui/replies.ts";

/** Informations publiques Discord uniquement : aucune donnée de suivi n'apparaît ici. */
export const userInfoCommand: Command = {
  definition: new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription(messages.general.userInfo.description)
    .addUserOption((option) =>
      option
        .setName("member")
        .setDescription(messages.general.memberOption)
        .setRequired(false),
    )
    .toJSON(),
  requiredRole: "member",
  async execute(interaction) {
    const user = interaction.options.getUser("member") ?? interaction.user;
    const member = await interaction.guild?.members.fetch(user.id).catch(() => null);
    const roles = member
      ? [...member.roles.cache.values()]
          .filter((role) => role.id !== interaction.guildId)
          .sort((a, b) => b.position - a.position)
          .map((role) => `<@&${role.id}>`)
      : [];
    const text = messages.general.userInfo;

    await respond(
      interaction,
      createPanel({
        category: "general",
        title: member?.displayName ?? user.displayName,
        description: user.bot ? text.bot : undefined,
        thumbnail: user.displayAvatarURL({ size: 256 }),
        fields: [
          { name: text.id, value: `\`${user.id}\`` },
          { name: text.created, value: discordTime(user.createdAt) },
          ...(member?.joinedAt
            ? [{ name: text.joined, value: discordTime(member.joinedAt) }]
            : []),
          { name: text.roles, value: roles.length ? roles.join(" ") : text.noRoles },
        ],
      }),
    );
  },
};

import { SlashCommandSubcommandBuilder } from "discord.js";

import type { Command } from "@/discord/commands/command.ts";
import { discordTime } from "@/discord/formatting.ts";
import { messages } from "@/discord/messages.ts";
import { createPanel } from "@/discord/ui/panels.ts";
import { respond } from "@/discord/ui/replies.ts";

/** Informations publiques Discord uniquement : aucune donnée de suivi n'apparaît ici. */
export const userInfoCommand: Command = {
  definition: new SlashCommandSubcommandBuilder()
    .setName("user")
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
    // Sur soi-même, pas de nom ni d'avatar : l'auteur de la commande les connaît déjà.
    const isSelf = user.id === interaction.user.id;

    await respond(
      interaction,
      createPanel({
        category: "general",
        title: isSelf ? text.selfTitle : (member?.displayName ?? user.displayName),
        description: user.bot ? text.bot : undefined,
        ...(isSelf ? {} : { thumbnail: user.displayAvatarURL({ size: 256 }) }),
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

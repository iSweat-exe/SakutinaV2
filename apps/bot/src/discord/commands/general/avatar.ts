import { SlashCommandSubcommandBuilder } from "discord.js";

import type { Command } from "@/discord/commands/command.ts";
import { messages } from "@/discord/messages.ts";
import { createPanel, type PanelImage } from "@/discord/ui/panels.ts";
import { respond } from "@/discord/ui/replies.ts";

const SIZE = 1024;

/** Galerie d'images : l'avatar du compte et, s'il en a un, l'avatar propre à ce serveur. */
export const avatarCommand: Command = {
  definition: new SlashCommandSubcommandBuilder()
    .setName("avatar")
    .setDescription(messages.general.avatar.description)
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
    const text = messages.general.avatar;
    const images: PanelImage[] = [
      { url: user.displayAvatarURL({ size: SIZE }), description: text.account },
    ];

    // `member.avatar` n'existe que si le membre a un avatar propre à ce serveur.
    if (member?.avatar) {
      images.push({ url: member.displayAvatarURL({ size: SIZE }), description: text.server });
    }

    await respond(
      interaction,
      createPanel({
        category: "general",
        title: user.id === interaction.user.id ? text.self : text.title(user.displayName),
        images,
      }),
    );
  },
};

import { SlashCommandSubcommandBuilder } from "discord.js";

import type { Command } from "@/discord/commands/command.ts";
import { buildDossierPanel, type LiveIdentity } from "@/discord/commands/phaethon/dossier-panel.ts";
import { recordAudit } from "@/discord/audit.ts";
import { messages } from "@/discord/messages.ts";
import { respond } from "@/discord/ui/replies.ts";

/**
 * Le dossier complet d'un membre : identité, activité, rythme, relations, présence
 * et chronologie. Réservé aux administrateurs, privé et journalisé.
 */
export const profileCommand: Command = {
  definition: new SlashCommandSubcommandBuilder()
    .setName("profile")
    .setDescription(messages.phaethon.profile.description)
    .addUserOption((option) =>
      option.setName("member").setDescription(messages.phaethon.memberOption).setRequired(true),
    )
    .toJSON(),
  requiredRole: "admin",
  async execute(interaction, context) {
    const user = interaction.options.getUser("member", true);
    const member = await interaction.guild?.members.fetch(user.id).catch(() => null);
    const dossier = await context.phaethonService.dossier(context.config.primaryGuildId, user.id);

    const live: LiveIdentity = {
      username: user.username,
      displayName: member?.displayName ?? user.displayName,
      avatarUrl: user.displayAvatarURL({ size: 64 }),
      createdAt: user.createdAt,
      isBot: user.bot,
      roleIds: member
        ? [...member.roles.cache.values()]
            .filter((role) => role.id !== interaction.guildId)
            .sort((a, b) => b.position - a.position)
            .map((role) => role.id)
        : [],
      premiumSince: member?.premiumSince ?? null,
      timeoutUntil: member?.communicationDisabledUntil ?? null,
    };

    await recordAudit(context, "profile.viewed", interaction.user.id, user.id);
    // Sur son propre dossier, l'administrateur connaît déjà son nom et son avatar.
    await respond(interaction, buildDossierPanel(dossier, live, user.id !== interaction.user.id), {
      ephemeral: true,
    });
  },
};

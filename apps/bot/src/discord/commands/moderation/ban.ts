import { SlashCommandSubcommandBuilder } from "discord.js";

import type { Command } from "@/discord/commands/command.ts";
import { auditReason, done, readReason, sanction } from "@/discord/commands/moderation/shared.ts";
import { messages } from "@/discord/messages.ts";
import { MAX_REASON_LENGTH } from "@/domain/moderation/moderation-rules.ts";

const text = messages.moderation;
const DAY_SECONDS = 86_400;

/** Bannit un membre, ou un utilisateur qui n'est plus sur le serveur (la cible peut être absente). */
export const banCommand: Command = {
  definition: new SlashCommandSubcommandBuilder()
    .setName("ban")
    .setDescription(text.ban.description)
    .addUserOption((option) => option.setName("member").setDescription(text.memberOption).setRequired(true))
    .addStringOption((option) =>
      option.setName("reason").setDescription(text.reasonOption).setRequired(true).setMaxLength(MAX_REASON_LENGTH),
    )
    .addIntegerOption((option) =>
      option.setName("delete_days").setDescription(text.ban.deleteDaysOption).setMinValue(0).setMaxValue(7),
    )
    .toJSON(),
  requiredRole: "admin",
  async execute(interaction, context, invoker) {
    const user = interaction.options.getUser("member", true);
    const reason = readReason(interaction);
    const deleteDays = interaction.options.getInteger("delete_days") ?? 0;

    await sanction(interaction, context, invoker, {
      action: "moderation.ban",
      user,
      reason,
      requireMember: false,
      botCan: (member) => member.bannable,
      perform: async () => {
        await interaction.guild?.members.ban(user, {
          reason: auditReason(interaction, reason),
          deleteMessageSeconds: deleteDays * DAY_SECONDS,
        });
      },
      success: () => done(text.ban.title, text.ban.text(`<@${user.id}>`)),
      notify: { title: text.ban.dmTitle, beforeAction: true },
      metadata: { deleteDays },
    });
  },
};

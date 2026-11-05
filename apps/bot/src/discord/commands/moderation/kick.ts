import { SlashCommandSubcommandBuilder } from "discord.js";

import type { Command } from "@/discord/commands/command.ts";
import { auditReason, done, readReason, sanction } from "@/discord/commands/moderation/shared.ts";
import { messages } from "@/discord/messages.ts";
import { MAX_REASON_LENGTH } from "@/domain/moderation/moderation-rules.ts";

const text = messages.moderation;

export const kickCommand: Command = {
  definition: new SlashCommandSubcommandBuilder()
    .setName("kick")
    .setDescription(text.kick.description)
    .addUserOption((option) => option.setName("member").setDescription(text.memberOption).setRequired(true))
    .addStringOption((option) =>
      option.setName("reason").setDescription(text.reasonOption).setRequired(true).setMaxLength(MAX_REASON_LENGTH),
    )
    .toJSON(),
  requiredRole: "moderator",
  async execute(interaction, context, invoker) {
    const user = interaction.options.getUser("member", true);
    const reason = readReason(interaction);

    await sanction(interaction, context, invoker, {
      action: "moderation.kick",
      user,
      reason,
      requireMember: true,
      botCan: (member) => member.kickable,
      perform: async (member) => {
        await member?.kick(auditReason(interaction, reason));
      },
      success: () => done(text.kick.title, text.kick.text(`<@${user.id}>`)),
      notify: { title: text.kick.dmTitle, beforeAction: true },
    });
  },
};

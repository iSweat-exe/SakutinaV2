import { SlashCommandSubcommandBuilder } from "discord.js";

import type { Command } from "@/discord/commands/command.ts";
import { auditReason, done, sanction } from "@/discord/commands/moderation/shared.ts";
import { messages } from "@/discord/messages.ts";
import { MAX_REASON_LENGTH } from "@/domain/moderation/moderation-rules.ts";

const text = messages.moderation;

export const untimeoutCommand: Command = {
  definition: new SlashCommandSubcommandBuilder()
    .setName("untimeout")
    .setDescription(text.untimeout.description)
    .addUserOption((option) => option.setName("member").setDescription(text.memberOption).setRequired(true))
    .addStringOption((option) =>
      option.setName("reason").setDescription(text.reasonOption).setMaxLength(MAX_REASON_LENGTH),
    )
    .toJSON(),
  requiredRole: "moderator",
  async execute(interaction, context, invoker) {
    const user = interaction.options.getUser("member", true);
    const reason = (interaction.options.getString("reason") ?? "").trim() || "—";

    await sanction(interaction, context, invoker, {
      action: "moderation.untimeout",
      user,
      reason,
      requireMember: true,
      botCan: (member) => member.moderatable,
      perform: async (member) => {
        await member?.timeout(null, auditReason(interaction, reason));
      },
      success: () => done(text.untimeout.title, text.untimeout.text(`<@${user.id}>`)),
    });
  },
};

import { guildIdOf } from "@/discord/guild.ts";
import { SlashCommandSubcommandBuilder } from "discord.js";

import type { Command } from "@/discord/commands/command.ts";
import { done, readReason, sanction } from "@/discord/commands/moderation/shared.ts";
import { messages } from "@/discord/messages.ts";
import { MAX_REASON_LENGTH } from "@/domain/moderation/moderation-rules.ts";
import type { Warning } from "@/domain/moderation/moderation-types.ts";

const text = messages.moderation;

/** Un avertissement est gardé un an et se retire avec `/mod unwarn`. */
export const warnCommand: Command = {
  definition: new SlashCommandSubcommandBuilder()
    .setName("warn")
    .setDescription(text.warn.description)
    .addUserOption((option) => option.setName("member").setDescription(text.memberOption).setRequired(true))
    .addStringOption((option) =>
      option.setName("reason").setDescription(text.reasonOption).setRequired(true).setMaxLength(MAX_REASON_LENGTH),
    )
    .toJSON(),
  requiredRole: "moderator",
  async execute(interaction, context, invoker) {
    const user = interaction.options.getUser("member", true);
    const reason = readReason(interaction);
    const guildId = guildIdOf(interaction);
    let issued: Warning | null = null;

    await sanction(interaction, context, invoker, {
      action: "moderation.warn",
      user,
      reason,
      requireMember: true,
      botCan: () => true,
      perform: async () => {
        issued = await context.moderationService.warn(guildId, user.id, interaction.user.id, reason);
      },
      success: async () => {
        const { total } = await context.moderationService.warnings(guildId, user.id);

        return done(text.warn.title, text.warn.text(`<@${user.id}>`, (issued as Warning | null)?.id ?? 0, total));
      },
      notify: { title: text.warn.dmTitle },
    });
  },
};

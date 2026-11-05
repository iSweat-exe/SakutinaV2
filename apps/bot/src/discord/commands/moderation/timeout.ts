import { SlashCommandSubcommandBuilder } from "discord.js";

import type { Command } from "@/discord/commands/command.ts";
import {
  auditReason,
  done,
  readReason,
  sanction,
} from "@/discord/commands/moderation/shared.ts";
import { discordTime } from "@/discord/formatting.ts";
import { messages } from "@/discord/messages.ts";
import { errorPanel } from "@/discord/ui/panels.ts";
import { respondPrivately } from "@/discord/ui/replies.ts";
import { MAX_REASON_LENGTH, parseDuration } from "@/domain/moderation/moderation-rules.ts";

const text = messages.moderation;

/** Réduit un membre au silence (Discord : de 1 minute à 28 jours). */
export const timeoutCommand: Command = {
  definition: new SlashCommandSubcommandBuilder()
    .setName("timeout")
    .setDescription(text.timeout.description)
    .addUserOption((option) => option.setName("member").setDescription(text.memberOption).setRequired(true))
    .addStringOption((option) =>
      option.setName("duration").setDescription(text.timeout.durationOption).setRequired(true).setMaxLength(10),
    )
    .addStringOption((option) =>
      option.setName("reason").setDescription(text.reasonOption).setRequired(true).setMaxLength(MAX_REASON_LENGTH),
    )
    .toJSON(),
  requiredRole: "moderator",
  async execute(interaction, context, invoker) {
    const user = interaction.options.getUser("member", true);
    const duration = parseDuration(interaction.options.getString("duration", true));

    if (duration === null) {
      await respondPrivately(
        interaction,
        errorPanel({ category: "admin", title: text.timeout.invalidTitle, description: text.timeout.invalid }),
      );
      return;
    }

    const reason = readReason(interaction);
    const until = discordTime(new Date(Date.now() + duration), "f");

    await sanction(interaction, context, invoker, {
      action: "moderation.timeout",
      user,
      reason,
      requireMember: true,
      botCan: (member) => member.moderatable,
      perform: async (member) => {
        await member?.timeout(duration, auditReason(interaction, reason));
      },
      success: () => done(text.timeout.title, text.timeout.text(`<@${user.id}>`, until)),
      notify: { title: text.timeout.dmTitle, extra: `→ ${until}` },
      metadata: { durationMinutes: Math.round(duration / 60_000) },
    });
  },
};

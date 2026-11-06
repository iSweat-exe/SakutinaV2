import { MessageFlags, SlashCommandSubcommandBuilder } from "discord.js";

import type { Command } from "@/discord/commands/command.ts";
import { messages } from "@/discord/messages.ts";
import { createPanel, successPanel, warningPanel } from "@/discord/ui/panels.ts";
import { respondPrivately } from "@/discord/ui/replies.ts";

/** `/server lockdown` : déclare un raid à la main. Salons fermés à @everyone, arrivants traités selon les réglages. */
export const lockdownCommand: Command = {
  definition: new SlashCommandSubcommandBuilder()
    .setName("lockdown")
    .setDescription(messages.antiRaid.lockdown.description)
    .toJSON(),
  requiredRole: "admin",
  async execute(interaction, { raidGuard }) {
    const text = messages.antiRaid;
    const guild = interaction.guild;

    if (!guild) {
      return;
    }

    // Verrouiller des dizaines de salons peut dépasser les 3 secondes accordées à une réponse.
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const result = await raidGuard.lockdown(guild, interaction.user.id);

    if (!result) {
      await respondPrivately(interaction, warningPanel({ category: "admin", title: text.lockdown.title, description: text.lockdown.already }));
      return;
    }

    const { lock, raid } = result;

    await respondPrivately(
      interaction,
      lock.failed > 0
        ? createPanel({
            category: "admin",
            tone: "warning",
            title: text.lockdown.title,
            description: `${text.lockdown.body}\n${text.notLocked(lock.failed)}`,
            fields: [
              { name: text.fields.channels, value: text.lockedChannels(lock.locked) },
              { name: text.fields.response, value: text.actions[raid.action] },
            ],
          })
        : successPanel({
            category: "admin",
            title: text.lockdown.title,
            description: text.lockdown.body,
            fields: [
              { name: text.fields.channels, value: text.lockedChannels(lock.locked) },
              { name: text.fields.verification, value: lock.verificationRaised ? text.verificationRaised : text.verificationUnchanged },
              { name: text.fields.response, value: text.actions[raid.action] },
            ],
          }),
    );
  },
};

import { SlashCommandSubcommandBuilder } from "discord.js";

import type { Command } from "@/discord/commands/command.ts";
import { formatCoins } from "@/discord/formatting.ts";
import { guildIdOf } from "@/discord/guild.ts";
import { messages } from "@/discord/messages.ts";
import { createPanel } from "@/discord/ui/panels.ts";
import { respond } from "@/discord/ui/replies.ts";

/** Ce que le serveur garde : la taxe des paiements et les mises du casino. */
export const treasuryCommand: Command = {
  definition: new SlashCommandSubcommandBuilder()
    .setName("treasury")
    .setDescription(messages.general.treasury.description)
    .toJSON(),
  requiredRole: "member",
  async execute(interaction, { economyService, guildService }) {
    const guildId = guildIdOf(interaction);
    const text = messages.general.treasury;
    const [balance, settings] = await Promise.all([economyService.treasury(guildId), guildService.settings(guildId)]);

    await respond(
      interaction,
      createPanel({
        category: "economy",
        title: text.title,
        description: [
          `## ${formatCoins(balance, settings.currencyName)}`,
          text.taxLine(settings.transferTaxPercent),
          text.interestLine(settings.bankInterestPermille),
          `-# ${text.footer}`,
        ].join("\n"),
      }),
    );
  },
};

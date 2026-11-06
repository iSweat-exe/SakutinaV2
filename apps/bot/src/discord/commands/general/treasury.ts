import { SlashCommandSubcommandBuilder } from "discord.js";

import type { Command } from "@/discord/commands/command.ts";
import { formatCoins } from "@/discord/formatting.ts";
import { guildIdOf } from "@/discord/guild.ts";
import { messages } from "@/discord/messages.ts";
import { createPanel } from "@/discord/ui/panels.ts";
import { respond } from "@/discord/ui/replies.ts";

/** Les caisses du serveur en circuit fermé : la réserve, le compte du casino et la cagnotte du jackpot. */
export const treasuryCommand: Command = {
  definition: new SlashCommandSubcommandBuilder()
    .setName("treasury")
    .setDescription(messages.general.treasury.description)
    .toJSON(),
  requiredRole: "member",
  async execute(interaction, { economyService, guildService }) {
    const guildId = guildIdOf(interaction);
    const text = messages.general.treasury;
    const [pools, settings] = await Promise.all([economyService.pools(guildId), guildService.settings(guildId)]);
    const coins = (amount: number) => formatCoins(amount, settings.currencyName);

    await respond(
      interaction,
      createPanel({
        category: "economy",
        title: text.title,
        description: [
          `## ${coins(pools.reserve)}`,
          text.poolsLine(coins(pools.casino), coins(pools.jackpot)),
          text.salaryLine(settings.salaryBudgetPermille),
          text.taxLine(settings.transferTaxPercent),
          text.wealthLine(settings.wealthTaxPermille, settings.idleTaxPermille),
          text.interestLine(settings.bankInterestPermille),
          `-# ${text.footer}`,
        ].join("\n"),
      }),
    );
  },
};

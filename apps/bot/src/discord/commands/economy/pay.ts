import { SlashCommandSubcommandBuilder } from "discord.js";

import type { Command } from "@/discord/commands/command.ts";
import { replayedPanel, replyOnEconomyError } from "@/discord/commands/economy/shared.ts";
import { formatCoins } from "@/discord/formatting.ts";
import { guildIdOf } from "@/discord/guild.ts";
import { messages } from "@/discord/messages.ts";
import { errorPanel, successPanel } from "@/discord/ui/panels.ts";
import { respond, respondPrivately } from "@/discord/ui/replies.ts";

/** `/economy pay` : portefeuille à portefeuille, avec la taxe de transfert du serveur. */
export const payCommand: Command = {
  definition: new SlashCommandSubcommandBuilder()
    .setName("pay")
    .setDescription(messages.economy.pay.description)
    .addUserOption((option) =>
      option.setName("member").setDescription(messages.economy.pay.memberOption).setRequired(true),
    )
    .addIntegerOption((option) =>
      option.setName("amount").setDescription(messages.economy.amountOption).setMinValue(1).setRequired(true),
    )
    .toJSON(),
  requiredRole: "member",
  async execute(interaction, { economyService, guildService }) {
    const recipient = interaction.options.getUser("member", true);
    const amount = interaction.options.getInteger("amount", true);
    const guildId = guildIdOf(interaction);
    const { currencyName, transferTaxPercent } = await guildService.settings(guildId);
    const text = messages.economy.pay;

    if (recipient.bot) {
      await respondPrivately(
        interaction,
        errorPanel({ category: "economy", title: text.botTitle, description: text.bot }),
      );
      return;
    }

    await replyOnEconomyError(interaction, currencyName, async () => {
      const result = await economyService.pay(
        guildId,
        interaction.user.id,
        recipient.id,
        amount,
        transferTaxPercent,
        interaction.id,
      );

      if (result.from.replayed) {
        await respond(interaction, replayedPanel(), { ephemeral: true });
        return;
      }

      const { fields } = messages.economy;

      await respond(
        interaction,
        successPanel({
          category: "economy",
          title: text.title,
          description: text.sent(`<@${recipient.id}>`, formatCoins(result.received, currencyName)),
          fields: [
            ...(result.tax > 0
              ? [{ name: text.taxField(transferTaxPercent), value: formatCoins(result.tax, currencyName) }]
              : []),
            { name: fields.wallet, value: formatCoins(result.from.account.wallet, currencyName) },
          ],
          timestamp: true,
        }),
      );
    });
  },
};

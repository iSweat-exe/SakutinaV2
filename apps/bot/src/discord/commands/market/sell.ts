import { SlashCommandSubcommandBuilder } from "discord.js";

import type { Command } from "@/discord/commands/command.ts";
import { replayedPanel, replyOnEconomyError } from "@/discord/commands/economy/shared.ts";
import { formatCoins, formatShort } from "@/discord/formatting.ts";
import { guildIdOf } from "@/discord/guild.ts";
import { messages } from "@/discord/messages.ts";
import { successPanel } from "@/discord/ui/panels.ts";
import { respond } from "@/discord/ui/replies.ts";
import { CASINO_SHARES } from "@/domain/economy/economy-rules.ts";

/** `/market sell` : un ordre au cours, le serveur est la contrepartie et l'argent passe par la réserve. */
export const sellCommand: Command = {
  definition: new SlashCommandSubcommandBuilder()
    .setName("sell")
    .setDescription(messages.market.sell.description)
    .addIntegerOption((option) =>
      option.setName("count").setDescription(messages.market.countOption).setMinValue(1).setMaxValue(CASINO_SHARES).setRequired(true),
    )
    .toJSON(),
  requiredRole: "member",
  async execute(interaction, { economyService, guildService }) {
    const guildId = guildIdOf(interaction);
    const { currencyName } = await guildService.settings(guildId);

    await replyOnEconomyError(interaction, currencyName, async () => {
      const result = await economyService.sellShares(guildId, interaction.user.id, interaction.options.getInteger("count", true), interaction.id);

      if (result.replayed) {
        await respond(interaction, replayedPanel(), { ephemeral: true });
        return;
      }

      const text = messages.market.sell;

      await respond(
        interaction,
        successPanel({
          category: "casino",
          title: text.title,
          description: text.text(
            result.shares,
            formatCoins(result.value - result.fee, currencyName),
            formatCoins(result.fee, currencyName),
            formatShort(result.account.wallet),
          ),
        }),
      );
    });
  },
};

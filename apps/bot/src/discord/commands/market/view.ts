import { SlashCommandSubcommandBuilder } from "discord.js";

import type { Command } from "@/discord/commands/command.ts";
import { formatPrice } from "@/discord/commands/market/shared.ts";
import { formatCoins } from "@/discord/formatting.ts";
import { guildIdOf } from "@/discord/guild.ts";
import { messages } from "@/discord/messages.ts";
import { createPanel } from "@/discord/ui/panels.ts";
import { respondPrivately } from "@/discord/ui/replies.ts";

/** `/market view` : le cours de l'action Casino, sa variation sur 24 h et ce que le membre en détient. */
export const viewCommand: Command = {
  definition: new SlashCommandSubcommandBuilder()
    .setName("view")
    .setDescription(messages.market.view.description)
    .toJSON(),
  requiredRole: "member",
  async execute(interaction, { economyService, guildService }) {
    const guildId = guildIdOf(interaction);
    const text = messages.market.view;
    const [market, account, settings] = await Promise.all([
      economyService.market(guildId),
      economyService.getAccount(guildId, interaction.user.id),
      guildService.settings(guildId),
    ]);
    const currency = settings.currencyName;
    const { pools, priceCents, dayAgoCents } = market;
    const change =
      dayAgoCents && dayAgoCents > 0
        ? text.change(
            priceCents >= dayAgoCents ? "+" : "−",
            (Math.abs(priceCents - dayAgoCents) / dayAgoCents * 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 }),
          )
        : text.noChange;
    const value = Math.floor((account.shares * pools.casino) / pools.shares);

    await respondPrivately(
      interaction,
      createPanel({
        category: "casino",
        title: text.title,
        description: [
          text.price(formatPrice(priceCents, currency)),
          change,
          text.holding(account.shares, formatCoins(value, currency)),
          text.fund(formatCoins(pools.casino, currency), formatCoins(pools.jackpot, currency)),
          text.float(pools.float, pools.shares),
          `-# ${text.footer}`,
        ].join("\n"),
      }),
    );
  },
};

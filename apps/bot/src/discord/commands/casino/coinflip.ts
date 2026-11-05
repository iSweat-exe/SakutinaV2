import { SlashCommandSubcommandBuilder } from "discord.js";

import { coinflipPanel } from "@/discord/casino/panels.ts";
import type { Command } from "@/discord/commands/command.ts";
import { replayedPanel, replyOnEconomyError } from "@/discord/commands/economy/shared.ts";
import { guildIdOf } from "@/discord/guild.ts";
import { messages } from "@/discord/messages.ts";
import { respond } from "@/discord/ui/replies.ts";
import { MAX_BET, MIN_BET } from "@/domain/casino/casino-rules.ts";
import { SIDES, type Side } from "@/domain/casino/coinflip.ts";

/** `/casino coinflip` : on choisit un côté ; 49 % de chances de doubler sa mise. */
export const coinflipCommand: Command = {
  definition: new SlashCommandSubcommandBuilder()
    .setName("coinflip")
    .setDescription(messages.casino.coinflip.description)
    .addIntegerOption((option) =>
      option.setName("bet").setDescription(messages.casino.betOption).setMinValue(MIN_BET).setMaxValue(MAX_BET.coinflip).setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("side")
        .setDescription(messages.casino.coinflip.sideOption)
        .addChoices(...SIDES.map((side) => ({ name: messages.casino.coinflip[side], value: side })))
        .setRequired(true),
    )
    .toJSON(),
  requiredRole: "member",
  async execute(interaction, { casinoService, guildService }) {
    const guildId = guildIdOf(interaction);
    const { currencyName } = await guildService.settings(guildId);
    const side = interaction.options.getString("side", true) as Side;

    await replyOnEconomyError(interaction, currencyName, async () => {
      const played = await casinoService.coinflip(guildId, interaction.user.id, interaction.options.getInteger("bet", true), side, interaction.id);

      await (played.replayed ? respond(interaction, replayedPanel(), { ephemeral: true }) : respond(interaction, coinflipPanel(played, side, currencyName)));
    });
  },
};

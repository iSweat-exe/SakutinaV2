import { SlashCommandSubcommandBuilder } from "discord.js";

import { startBlackjack } from "@/discord/casino/blackjack-flow.ts";
import type { Command } from "@/discord/commands/command.ts";
import { messages } from "@/discord/messages.ts";
import { MIN_BET } from "@/domain/casino/casino-rules.ts";

/** `/casino blackjack` : une main contre le croupier ; tirer, rester ou doubler avec les boutons. */
export const blackjackCommand: Command = {
  definition: new SlashCommandSubcommandBuilder()
    .setName("blackjack")
    .setDescription(messages.casino.blackjack.description)
    .addIntegerOption((option) =>
      option.setName("bet").setDescription(messages.casino.betOption).setMinValue(MIN_BET).setRequired(true),
    )
    .toJSON(),
  requiredRole: "member",
  execute: (interaction, context) => startBlackjack(interaction, context),
};

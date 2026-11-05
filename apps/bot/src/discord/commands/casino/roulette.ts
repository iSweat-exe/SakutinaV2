import { SlashCommandSubcommandBuilder } from "discord.js";

import { roulettePanel } from "@/discord/casino/panels.ts";
import type { Command } from "@/discord/commands/command.ts";
import { replayedPanel, replyOnEconomyError } from "@/discord/commands/economy/shared.ts";
import { guildIdOf } from "@/discord/guild.ts";
import { messages } from "@/discord/messages.ts";
import { errorPanel } from "@/discord/ui/panels.ts";
import { respond, respondPrivately } from "@/discord/ui/replies.ts";
import { MIN_BET } from "@/domain/casino/casino-rules.ts";
import type { RouletteBet } from "@/domain/casino/roulette.ts";

const text = messages.casino.roulette;
const KINDS = ["red", "black", "even", "odd", "low", "high", "number"] as const;

/** `/casino roulette` : roulette européenne ; une couleur, la parité, une moitié du tapis ou un numéro plein. */
export const rouletteCommand: Command = {
  definition: new SlashCommandSubcommandBuilder()
    .setName("roulette")
    .setDescription(text.description)
    .addIntegerOption((option) =>
      option.setName("bet").setDescription(messages.casino.betOption).setMinValue(MIN_BET).setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("on")
        .setDescription(text.onOption)
        .addChoices(...KINDS.map((kind) => ({ name: text.choices[kind], value: kind })))
        .setRequired(true),
    )
    .addIntegerOption((option) => option.setName("number").setDescription(text.numberOption).setMinValue(0).setMaxValue(36))
    .toJSON(),
  requiredRole: "member",
  async execute(interaction, { casinoService, guildService }) {
    const guildId = guildIdOf(interaction);
    const { currencyName } = await guildService.settings(guildId);
    const kind = interaction.options.getString("on", true) as (typeof KINDS)[number];
    const number = interaction.options.getInteger("number");

    const refuse = (title: string, description: string) =>
      respondPrivately(interaction, errorPanel({ category: "casino", title, description }));

    if (kind === "number" && number === null) {
      await refuse(text.numberMissingTitle, text.numberMissing);
      return;
    }

    if (kind !== "number" && number !== null) {
      await refuse(text.numberUnexpectedTitle, text.numberUnexpected);
      return;
    }

    const on: RouletteBet = kind === "number" ? { kind, number: number ?? 0 } : { kind };

    await replyOnEconomyError(interaction, currencyName, async () => {
      const played = await casinoService.roulette(guildId, interaction.user.id, interaction.options.getInteger("bet", true), on, interaction.id);

      await (played.replayed ? respond(interaction, replayedPanel(), { ephemeral: true }) : respond(interaction, roulettePanel(played, on, currencyName)));
    });
  },
};

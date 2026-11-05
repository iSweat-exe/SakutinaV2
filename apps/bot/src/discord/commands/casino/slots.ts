import { SlashCommandSubcommandBuilder } from "discord.js";

import { slotsPanel } from "@/discord/casino/panels.ts";
import type { Command } from "@/discord/commands/command.ts";
import { replayedPanel, replyOnEconomyError } from "@/discord/commands/economy/shared.ts";
import { guildIdOf } from "@/discord/guild.ts";
import { messages } from "@/discord/messages.ts";
import { respond } from "@/discord/ui/replies.ts";
import { MAX_BET, MIN_BET } from "@/domain/casino/casino-rules.ts";

/** `/casino slots` : trois rouleaux, la mise est réglée d'un coup dans le grand livre. */
export const slotsCommand: Command = {
  definition: new SlashCommandSubcommandBuilder()
    .setName("slots")
    .setDescription(messages.casino.slots.description)
    .addIntegerOption((option) =>
      option.setName("bet").setDescription(messages.casino.betOption).setMinValue(MIN_BET).setMaxValue(MAX_BET.slots).setRequired(true),
    )
    .toJSON(),
  requiredRole: "member",
  async execute(interaction, { casinoService, guildService }) {
    const guildId = guildIdOf(interaction);
    const { currencyName } = await guildService.settings(guildId);

    await replyOnEconomyError(interaction, currencyName, async () => {
      const played = await casinoService.slots(guildId, interaction.user.id, interaction.options.getInteger("bet", true), interaction.id);

      await (played.replayed ? respond(interaction, replayedPanel(), { ephemeral: true }) : respond(interaction, slotsPanel(played, currencyName)));
    });
  },
};

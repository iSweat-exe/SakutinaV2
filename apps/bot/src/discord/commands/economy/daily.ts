import { guildIdOf } from "@/discord/guild.ts";
import { SlashCommandSubcommandBuilder } from "discord.js";

import type { Command } from "@/discord/commands/command.ts";
import { replayedPanel, replyOnEconomyError } from "@/discord/commands/economy/shared.ts";
import { discordTime, formatCoins, formatShort } from "@/discord/formatting.ts";
import { messages } from "@/discord/messages.ts";
import { successPanel } from "@/discord/ui/panels.ts";
import { respond } from "@/discord/ui/replies.ts";
import { DAILY_COOLDOWN_MS } from "@/domain/economy/economy-rules.ts";

export const dailyCommand: Command = {
  definition: new SlashCommandSubcommandBuilder()
    .setName("daily")
    .setDescription(messages.economy.daily.description)
    .toJSON(),
  requiredRole: "member",
  async execute(interaction, { economyService, guildService }) {
    const guildId = guildIdOf(interaction);
    const { currencyName, salaryBudgetPermille } = await guildService.settings(guildId);

    return replyOnEconomyError(interaction, currencyName, async () => {
      const result = await economyService.daily(guildId, interaction.user.id, interaction.id, salaryBudgetPermille);

      if (result.replayed) {
        await respond(interaction, replayedPanel(), { ephemeral: true });
        return;
      }

      const text = messages.economy;

      await respond(
        interaction,
        successPanel({
          category: "economy",
          title: text.daily.title,
          description: text.daily.reward(
            formatCoins(result.entry.amount, currencyName),
            result.account.dailyStreak,
            formatShort(result.account.wallet),
            discordTime(new Date(Date.now() + DAILY_COOLDOWN_MS), "R"),
          ),
        }),
      );
    });
  },
};

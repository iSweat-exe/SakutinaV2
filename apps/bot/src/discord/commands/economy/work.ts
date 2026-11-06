import { guildIdOf } from "@/discord/guild.ts";
import { SlashCommandSubcommandBuilder } from "discord.js";

import type { Command } from "@/discord/commands/command.ts";
import { replayedPanel, replyOnEconomyError } from "@/discord/commands/economy/shared.ts";
import { discordTime, formatCoins, formatShort } from "@/discord/formatting.ts";
import { messages } from "@/discord/messages.ts";
import { successPanel } from "@/discord/ui/panels.ts";
import { respond } from "@/discord/ui/replies.ts";
import { WORK_COOLDOWN_MS } from "@/domain/economy/economy-rules.ts";

export const workCommand: Command = {
  definition: new SlashCommandSubcommandBuilder()
    .setName("work")
    .setDescription(messages.economy.work.description)
    .toJSON(),
  requiredRole: "member",
  async execute(interaction, { economyService, guildService }) {
    const { currencyName, salaryBudgetPermille } = await guildService.settings(guildIdOf(interaction));

    return replyOnEconomyError(interaction, currencyName, async () => {
      const result = await economyService.work(
        guildIdOf(interaction),
        interaction.user.id,
        interaction.id,
        salaryBudgetPermille,
      );

      if (result.replayed) {
        await respond(interaction, replayedPanel(), { ephemeral: true });
        return;
      }

      const text = messages.economy;

      await respond(
        interaction,
        successPanel({
          category: "economy",
          title: text.work.title,
          description: text.work.reward(
            formatCoins(result.entry.amount, currencyName),
            formatShort(result.account.wallet),
            discordTime(new Date(Date.now() + WORK_COOLDOWN_MS), "R"),
          ),
        }),
      );
    });
  },
};

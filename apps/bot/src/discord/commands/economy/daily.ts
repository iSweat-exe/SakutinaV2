import { SlashCommandSubcommandBuilder } from "discord.js";

import type { Command } from "@/discord/commands/command.ts";
import { replayedPanel, replyOnEconomyError } from "@/discord/commands/economy/shared.ts";
import { discordTime, formatCoins } from "@/discord/formatting.ts";
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
  execute(interaction, { config, economyService }) {
    return replyOnEconomyError(interaction, async () => {
      const result = await economyService.daily(
        config.primaryGuildId,
        interaction.user.id,
        interaction.id,
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
          title: text.daily.title,
          description: text.daily.reward(formatCoins(result.entry.amount)),
          fields: [
            {
              name: text.daily.streak,
              value: text.daily.days(result.account.dailyStreak),
            },
            {
              name: text.fields.wallet,
              value: formatCoins(result.account.wallet),
            },
            {
              name: text.daily.next,
              value: discordTime(new Date(Date.now() + DAILY_COOLDOWN_MS), "R"),
            },
          ],
          timestamp: true,
        }),
      );
    });
  },
};

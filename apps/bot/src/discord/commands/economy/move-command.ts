import { SlashCommandBuilder } from "discord.js";

import type { Command } from "@/discord/commands/command.ts";
import {
  readAmount,
  replayedPanel,
  replyOnEconomyError,
} from "@/discord/commands/economy/shared.ts";
import { formatCoins } from "@/discord/formatting.ts";
import { messages } from "@/discord/messages.ts";
import { errorPanel, successPanel } from "@/discord/ui/panels.ts";
import { respond, respondPrivately } from "@/discord/ui/replies.ts";
import type { EconomyService } from "@/domain/economy/economy-service.ts";

type MoveOptions = Readonly<{
  name: "deposit" | "withdraw";
  description: string;
  title: string;
  text: (amount: string) => string;
  run: EconomyService["deposit"];
}>;

/** `/deposit` et `/withdraw` ne diffèrent que par l'opération et les textes. */
export function createMoveCommand(options: MoveOptions): Command {
  return {
    definition: new SlashCommandBuilder()
      .setName(options.name)
      .setDescription(options.description)
      .addIntegerOption((option) =>
        option
          .setName("amount")
          .setDescription(messages.economy.amountOption)
          .setMinValue(1)
          .setRequired(false),
      )
      .addBooleanOption((option) =>
        option
          .setName("all")
          .setDescription(messages.economy.allOption)
          .setRequired(false),
      )
      .toJSON(),
    requiredRole: "member",
    async execute(interaction, { config, economyService }) {
      const amount = readAmount(interaction);

      if (amount === null) {
        await respondPrivately(
          interaction,
          errorPanel({
            category: "economy",
            title: messages.economy.errors.chooseOneTitle,
            description: messages.economy.errors.chooseOne,
          }),
        );
        return;
      }

      await replyOnEconomyError(interaction, async () => {
        const result = await options.run.call(
          economyService,
          config.primaryGuildId,
          interaction.user.id,
          amount,
          interaction.id,
        );

        if (result.replayed) {
          await respond(interaction, replayedPanel(), { ephemeral: true });
          return;
        }

        const { fields } = messages.economy;

        await respond(
          interaction,
          successPanel({
            category: "economy",
            title: options.title,
            description: options.text(formatCoins(result.entry.amount)),
            fields: [
              {
                name: fields.wallet,
                value: formatCoins(result.account.wallet),
              },
              {
                name: fields.bank,
                value: formatCoins(result.account.bank),
              },
            ],
            timestamp: true,
          }),
        );
      });
    },
  };
}

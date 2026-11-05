import { guildIdOf } from "@/discord/guild.ts";
import {
  LabelBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
  type MessageComponentInteraction,
  type ModalSubmitInteraction,
} from "discord.js";

import { buildBalancePanel } from "@/discord/commands/economy/balance-panel.ts";
import { replyOnEconomyError } from "@/discord/commands/economy/shared.ts";
import { encodeId } from "@/discord/components/custom-id.ts";
import type { ComponentHandler } from "@/discord/components/handler.ts";
import { formatCoins } from "@/discord/formatting.ts";
import type { HandlerContext } from "@/discord/handler-context.ts";
import { messages } from "@/discord/messages.ts";
import { errorPanel } from "@/discord/ui/panels.ts";
import { respondPrivately, update } from "@/discord/ui/replies.ts";

type Operation = "deposit" | "withdraw";

/** « tout » ou un entier positif ; `null` pour toute autre saisie. */
export function parseAmount(raw: string): number | "all" | null {
  const value = raw.trim().toLowerCase();

  if (value === "tout" || value === "all") {
    return "all";
  }

  return /^\d{1,15}$/.test(value) && Number(value) > 0 ? Number(value) : null;
}

function modal(ownerId: string): ModalBuilder {
  const text = messages.balanceActions;

  return new ModalBuilder()
    .setCustomId(encodeId("ba", "amount", ownerId))
    .setTitle(text.modalTitle)
    .addLabelComponents(
      new LabelBuilder()
        .setLabel(text.operationLabel)
        .setStringSelectMenuComponent(
          new StringSelectMenuBuilder()
            .setCustomId("operation")
            .setPlaceholder(text.operationPlaceholder)
            .addOptions(
              new StringSelectMenuOptionBuilder().setLabel(text.deposit).setValue("deposit").setDefault(true),
              new StringSelectMenuOptionBuilder().setLabel(text.withdraw).setValue("withdraw"),
            ),
        ),
      new LabelBuilder()
        .setLabel(text.amountLabel)
        .setDescription(text.amountHelp)
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("amount")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(text.amountPlaceholder)
            .setRequired(true)
            .setMaxLength(15),
        ),
    );
}

async function run(
  interaction: MessageComponentInteraction | ModalSubmitInteraction,
  context: HandlerContext,
  ownerId: string,
  operation: Operation,
  amount: number | "all",
): Promise<void> {
  const guildId = guildIdOf(interaction);
  const service = context.economyService;
  const { currencyName } = await context.guildService.settings(guildId);

  await replyOnEconomyError(interaction, currencyName, async () => {
    const result =
      operation === "deposit"
        ? await service.deposit(guildId, ownerId, amount, interaction.id)
        : await service.withdraw(guildId, ownerId, amount, interaction.id);
    const text = messages.balanceActions;
    const done = formatCoins(result.entry.amount, currencyName);

    await update(
      interaction,
      buildBalancePanel({
        user: interaction.user,
        account: result.account,
        currency: currencyName,
        ownerId,
        notice: operation === "deposit" ? text.depositDone(done) : text.withdrawDone(done),
      }),
    );
  });
}

/** Boutons « Tout déposer » / « Tout retirer » et modale de montant précis du solde. */
export const balanceComponents: ComponentHandler = {
  namespace: "ba",
  async handle(interaction, context, id) {
    switch (id.action) {
      case "deposit-all":
      case "withdraw-all":
        if (interaction.isButton()) {
          await run(
            interaction,
            context,
            id.ownerId,
            id.action === "deposit-all" ? "deposit" : "withdraw",
            "all",
          );
        }
        return;

      case "modal":
        if (interaction.isButton()) {
          await interaction.showModal(modal(id.ownerId));
        }
        return;

      case "amount": {
        if (!interaction.isModalSubmit()) {
          return;
        }

        const operation = interaction.fields.getStringSelectValues("operation")[0];
        const amount = parseAmount(interaction.fields.getTextInputValue("amount"));

        if (operation !== "deposit" && operation !== "withdraw") {
          await respondPrivately(
            interaction,
            errorPanel({
              category: "economy",
              title: messages.balanceActions.invalidOperationTitle,
              description: messages.balanceActions.invalidOperation,
            }),
          );
          return;
        }

        if (amount === null) {
          await respondPrivately(
            interaction,
            errorPanel({
              category: "economy",
              title: messages.economy.errors.invalidAmountTitle,
              description: messages.economy.errors.invalidAmount,
            }),
          );
          return;
        }

        await run(interaction, context, id.ownerId, operation, amount);
        return;
      }
    }
  },
};

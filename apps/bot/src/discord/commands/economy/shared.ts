import type { ChatInputCommandInteraction } from "discord.js";

import { discordTime, formatCoins } from "@/discord/formatting.ts";
import { messages } from "@/discord/messages.ts";
import { errorPanel, warningPanel } from "@/discord/ui/panels.ts";
import { respondPrivately, type Repliable } from "@/discord/ui/replies.ts";
import { EconomyError } from "@/domain/economy/economy-error.ts";

/** `"all"`, un montant, ou `null` si l'utilisateur n'a rien (ou trop) indiqué. */
export function readAmount(
  interaction: ChatInputCommandInteraction,
): number | "all" | null {
  const amount = interaction.options.getInteger("amount");
  const all = interaction.options.getBoolean("all") === true;

  if (all === (amount !== null)) {
    return null;
  }

  return all ? "all" : amount;
}

function refusal(error: EconomyError) {
  const { errors } = messages.economy;

  switch (error.code) {
    case "invalid_amount":
      return errorPanel({
        category: "economy",
        title: errors.invalidAmountTitle,
        description: errors.invalidAmount,
      });
    case "insufficient_funds":
      return errorPanel({
        category: "economy",
        title: errors.insufficientTitle,
        description: errors.insufficient(formatCoins(error.details.available ?? 0)),
      });
    case "cooldown": {
      const retryAt = new Date(Date.now() + (error.details.remainingMs ?? 0));

      return warningPanel({
        category: "economy",
        title: errors.cooldownTitle,
        description: errors.cooldown(discordTime(retryAt, "R")),
      });
    }
    case "balance_limit":
      return errorPanel({
        category: "economy",
        title: errors.limitTitle,
        description: errors.limit,
      });
  }
}

/** Exécute une opération économique ; un refus métier devient un embed clair et privé. */
export async function replyOnEconomyError(
  interaction: Repliable,
  run: () => Promise<void>,
): Promise<void> {
  try {
    await run();
  } catch (error) {
    if (error instanceof EconomyError) {
      await respondPrivately(interaction, refusal(error));
      return;
    }

    throw error;
  }
}

/** Embed commun aux opérations déjà enregistrées (même interaction rejouée). */
export function replayedPanel() {
  return warningPanel({
    category: "economy",
    title: messages.economy.replayed.title,
    description: messages.economy.replayed.text,
  });
}

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

/** Nom français d'un jeu du casino, pour dire lequel est fermé. */
function gameName(game: string | undefined): string {
  const { casino } = messages;

  switch (game) {
    case "slots":
      return casino.slots.title;
    case "blackjack":
      return casino.blackjack.title;
    case "roulette":
      return casino.roulette.title;
    case "coinflip":
      return casino.coinflip.title;
    default:
      return "Ce jeu";
  }
}

function refusal(error: EconomyError, currency: string) {
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
        description: errors.insufficient(formatCoins(error.details.available ?? 0, currency)),
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
    case "bet_limits":
      return errorPanel({
        category: "economy",
        title: errors.betLimitsTitle,
        description: errors.betLimits(formatCoins(error.details.min ?? 0, currency), formatCoins(error.details.max ?? 0, currency)),
      });
    case "game_closed":
      return errorPanel({
        category: "economy",
        title: errors.gameClosedTitle,
        description: errors.gameClosed(gameName(error.details.game)),
      });
    case "self_transfer":
      return errorPanel({
        category: "economy",
        title: errors.selfTransferTitle,
        description: errors.selfTransfer,
      });
    case "salary_exhausted":
      return warningPanel({
        category: "economy",
        title: errors.salaryExhaustedTitle,
        description: errors.salaryExhausted,
      });
    case "reserve_short":
      return warningPanel({
        category: "economy",
        title: errors.reserveShortTitle,
        description: errors.reserveShort(formatCoins(error.details.available ?? 0, currency)),
      });
    case "casino_limit":
      return warningPanel({
        category: "economy",
        title: errors.casinoLimitTitle,
        description: (error.details.max ?? 0) > 0 ? errors.casinoLimit(formatCoins(error.details.max ?? 0, currency)) : errors.casinoClosed,
      });
    case "shares_unavailable":
      return errorPanel({
        category: "economy",
        title: errors.sharesTitle,
        description: errors.shares(error.details.shares ?? 0),
      });
  }
}

/** Exécute une opération économique ; un refus métier devient un embed clair et privé. */
export async function replyOnEconomyError(
  interaction: Repliable,
  currency: string,
  run: () => Promise<void>,
): Promise<void> {
  try {
    await run();
  } catch (error) {
    if (error instanceof EconomyError) {
      await respondPrivately(interaction, refusal(error, currency));
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

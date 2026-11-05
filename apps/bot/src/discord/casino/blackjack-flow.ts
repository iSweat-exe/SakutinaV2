import type { ChatInputCommandInteraction } from "discord.js";

import { blackjackPanel } from "@/discord/casino/panels.ts";
import { replyOnEconomyError } from "@/discord/commands/economy/shared.ts";
import { guildIdOf } from "@/discord/guild.ts";
import type { HandlerContext } from "@/discord/handler-context.ts";
import { messages } from "@/discord/messages.ts";
import { errorPanel, type Panel } from "@/discord/ui/panels.ts";
import { editOriginal, respond } from "@/discord/ui/replies.ts";
import { canDouble, decidedAtDeal, hit, isBust, playerCanAct, totalOf, type Round } from "@/domain/casino/blackjack.ts";
import { logger } from "@/shared/logger.ts";

/** Une main sans action depuis aussi longtemps est terminée d'office : le joueur « reste ». */
export const BLACKJACK_TIMEOUT_MS = 120_000;

type Game = {
  readonly id: string;
  readonly guildId: string;
  readonly memberId: string;
  readonly currency: string;
  readonly interaction: ChatInputCommandInteraction;
  round: Round;
  /** Une action est en cours (écriture en base) : une autre doit attendre. */
  busy: boolean;
  timer: ReturnType<typeof setTimeout> | undefined;
};

/**
 * Les mains en cours, en mémoire : leur état (le jeu mélangé, les cartes) ne sert qu'à la durée d'une main. La mise
 * est déjà prélevée au début ; si le bot s'arrête pendant une main, `settleAllGames` la termine proprement.
 */
const games = new Map<string, Game>();

/** Nombre de mains en cours (tests et arrêt propre). */
export const activeGames = (): number => games.size;

const gone = (): Panel => errorPanel({ category: "casino", title: messages.casino.blackjack.goneTitle, description: messages.casino.blackjack.gone });

function arm(context: HandlerContext, game: Game): void {
  clearTimeout(game.timer);
  game.timer = setTimeout(() => void expire(context, game), BLACKJACK_TIMEOUT_MS);
  game.timer.unref?.();
}

/** Termine la main : le croupier joue, le gain est versé, la main sort de la mémoire. */
async function finish(context: HandlerContext, game: Game, note?: string): Promise<Panel> {
  const end = await context.casinoService.finishBlackjack(game.guildId, game.memberId, game.round, game.id);

  clearTimeout(game.timer);
  games.delete(game.id);

  const t = messages.casino.blackjack;
  const bust = isBust(end.round.player);
  const dealerBust = isBust(end.round.dealer);

  return blackjackPanel({
    state: "finished",
    round: end.round,
    outcome: end.outcome,
    net: end.net,
    wallet: end.account.wallet,
    currency: game.currency,
    note: note ?? (bust ? t.bust : dealerBust ? t.dealerBust : undefined),
  });
}

/** Délai dépassé : la main se termine toute seule et le message est mis à jour. */
async function expire(context: HandlerContext, game: Game): Promise<void> {
  if (game.busy || !games.has(game.id)) {
    return;
  }

  game.busy = true;

  try {
    const panel = await finish(context, game, messages.casino.blackjack.timeout);
    await editOriginal(game.interaction, panel);
  } catch (error) {
    logger.warn("Could not finish an idle blackjack hand", { gameId: game.id, error: error instanceof Error ? error.message : String(error) });
    game.busy = false;
  }
}

/** Termine une main laissée sans action (le minuteur la déclenche ; exposée pour les tests). */
export async function expireGame(context: HandlerContext, gameId: string): Promise<void> {
  const game = games.get(gameId);

  if (game) {
    await expire(context, game);
  }
}

/** Arrêt du bot : toutes les mains en cours sont terminées (le joueur « reste »), pour qu'aucune mise ne soit perdue. */
export async function settleAllGames(context: HandlerContext): Promise<void> {
  for (const game of [...games.values()]) {
    game.busy = true;

    try {
      const panel = await finish(context, game);
      await editOriginal(game.interaction, panel).catch(() => undefined);
    } catch (error) {
      logger.error("Could not settle a blackjack hand at shutdown", { gameId: game.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
}

/** `/casino blackjack` : mise prélevée, donne, puis boutons (ou résultat immédiat si la main est décidée). */
export async function startBlackjack(interaction: ChatInputCommandInteraction, context: HandlerContext): Promise<void> {
  const guildId = guildIdOf(interaction);
  const bet = interaction.options.getInteger("bet", true);
  const { currencyName } = await context.guildService.settings(guildId);

  await replyOnEconomyError(interaction, currencyName, async () => {
    const round = await context.casinoService.startBlackjack(guildId, interaction.user.id, bet, interaction.id);
    const game: Game = {
      id: interaction.id,
      guildId,
      memberId: interaction.user.id,
      currency: currencyName,
      interaction,
      round,
      busy: false,
      timer: undefined,
    };

    if (decidedAtDeal(round)) {
      games.set(game.id, game);
      await respond(interaction, await finish(context, game));
      return;
    }

    games.set(game.id, game);
    arm(context, game);
    await respond(interaction, blackjackPanel({ state: "playing", round, gameId: game.id, ownerId: interaction.user.id, currency: currencyName }));
  });
}

export type BlackjackAction = "hit" | "stand" | "double";

/**
 * Un bouton de la main. Renvoie le panneau qui remplace le message, ou `{ refused }` : un refus à montrer en privé
 * sans toucher au message. `gameId` est celui de la main.
 */
export async function actOnBlackjack(
  userId: string,
  context: HandlerContext,
  gameId: string,
  action: BlackjackAction,
): Promise<Panel | { refused: Panel }> {
  const game = games.get(gameId);

  if (!game || game.memberId !== userId) {
    return { refused: gone() };
  }

  if (game.busy) {
    return { refused: errorPanel({ category: "casino", title: messages.casino.blackjack.busyTitle, description: messages.casino.blackjack.busy }) };
  }

  game.busy = true;

  try {
    if (action === "stand") {
      return await finish(context, game);
    }

    if (action === "double") {
      if (!canDouble(game.round)) {
        game.busy = false;
        return blackjackPanel({ state: "playing", round: game.round, gameId, ownerId: game.memberId, currency: game.currency });
      }

      game.round = await context.casinoService.doubleBlackjack(game.guildId, game.memberId, game.round, game.id);

      return await finish(context, game);
    }

    game.round = hit(game.round);

    if (!playerCanAct(game.round) || totalOf(game.round.player).total >= 21) {
      return await finish(context, game);
    }

    arm(context, game);
    game.busy = false;

    return blackjackPanel({ state: "playing", round: game.round, gameId, ownerId: game.memberId, currency: game.currency });
  } catch (error) {
    game.busy = false;
    throw error;
  }
}

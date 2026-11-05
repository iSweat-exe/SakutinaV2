import { EconomyError } from "@/domain/economy/economy-error.ts";
import type { EconomyService } from "@/domain/economy/economy-service.ts";
import type { Account } from "@/domain/economy/economy-types.ts";
import { dealerPlay, deal, decidedAtDeal, doubleDown, isBust, outcomeOf, payoutOutcome, type Outcome, type Round } from "./blackjack.ts";
import { MAX_BET, MIN_BET, secureRandom, type Game, type Random } from "./casino-rules.ts";
import { flipCoin, type CoinflipResult, type Side } from "./coinflip.ts";
import { isValidBet, spinRoulette, type RouletteBet, type RouletteResult } from "./roulette.ts";
import { playSlots, type SlotsResult } from "./slots.ts";

/** Résultat d'un jeu à issue immédiate : le tirage, et ce que l'économie en a fait. */
export type Played<T> = Readonly<{
  result: T;
  bet: number;
  /** Gain net : positif, négatif ou nul. */
  net: number;
  account: Account;
  /** `true` si l'opération avait déjà été enregistrée (même interaction) : rien n'a été rejoué. */
  replayed: boolean;
}>;

export type BlackjackEnd = Readonly<{ outcome: Outcome; payout: number; bet: number; net: number; account: Account }>;

/**
 * Les jeux d'argent. Les règles et le tirage sont dans les fichiers de ce dossier (purs) ; ce service ne fait que
 * valider la mise et faire passer l'argent par l'économie, dans le grand livre, de façon atomique. Jamais de
 * sanction Discord : un jeu ne touche qu'au portefeuille.
 */
export class CasinoService {
  constructor(
    private readonly economy: EconomyService,
    private readonly random: Random = secureRandom,
  ) {}

  /** Refuse une mise hors des limites du jeu avant tout tirage. */
  assertBet(game: Game, bet: number): void {
    if (!Number.isSafeInteger(bet) || bet < MIN_BET || bet > MAX_BET[game]) {
      throw new EconomyError("bet_limits", { min: MIN_BET, max: MAX_BET[game] });
    }
  }

  async slots(guildId: string, memberId: string, bet: number, key: string): Promise<Played<SlotsResult>> {
    this.assertBet("slots", bet);
    const result = playSlots(this.random, bet);

    return this.finish(guildId, memberId, bet, result.payout, "casino:slots", key, result);
  }

  async coinflip(guildId: string, memberId: string, bet: number, side: Side, key: string): Promise<Played<CoinflipResult>> {
    this.assertBet("coinflip", bet);
    const result = flipCoin(this.random, side, bet);

    return this.finish(guildId, memberId, bet, result.payout, "casino:coinflip", key, result);
  }

  async roulette(guildId: string, memberId: string, bet: number, on: RouletteBet, key: string): Promise<Played<RouletteResult>> {
    this.assertBet("roulette", bet);

    if (!isValidBet(on)) {
      throw new EconomyError("invalid_amount");
    }

    const result = spinRoulette(this.random, on, bet);

    return this.finish(guildId, memberId, bet, result.payout, "casino:roulette", key, result);
  }

  /**
   * Début d'une main de blackjack : la mise quitte le portefeuille tout de suite (elle est en jeu), puis les cartes
   * sont distribuées. `gameId` identifie la main dans le grand livre.
   */
  async startBlackjack(guildId: string, memberId: string, bet: number, gameId: string): Promise<Round> {
    this.assertBet("blackjack", bet);
    await this.economy.spend(guildId, memberId, bet, "casino:blackjack:bet", `bj:${gameId}:bet`);

    return deal(this.random, bet);
  }

  /** « Doubler » : une seconde mise égale à la première quitte le portefeuille, une carte est tirée, la main s'arrête. */
  async doubleBlackjack(guildId: string, memberId: string, round: Round, gameId: string): Promise<Round> {
    await this.economy.spend(guildId, memberId, round.bet, "casino:blackjack:double", `bj:${gameId}:double`);

    return doubleDown(round);
  }

  /** Fin d'une main : le croupier joue (sauf si le joueur a dépassé 21), puis le gain éventuel est versé. */
  async finishBlackjack(guildId: string, memberId: string, round: Round, gameId: string): Promise<BlackjackEnd & { round: Round }> {
    // Le croupier ne joue pas si le joueur a dépassé 21 ou si la main était décidée à la donne.
    const finished = isBust(round.player) || decidedAtDeal(round) ? round : dealerPlay(round);
    const outcome = outcomeOf(finished);
    const payout = payoutOutcome(outcome, finished.bet);

    if (payout > 0) {
      await this.economy.credit(guildId, memberId, payout, `casino:blackjack:${outcome}`, `bj:${gameId}:out`);
    }

    return {
      round: finished,
      outcome,
      payout,
      bet: finished.bet,
      net: payout - finished.bet,
      account: await this.economy.getAccount(guildId, memberId),
    };
  }

  private async finish<T>(
    guildId: string,
    memberId: string,
    bet: number,
    payout: number,
    reason: string,
    key: string,
    result: T,
  ): Promise<Played<T>> {
    const settled = await this.economy.settle(guildId, memberId, bet, payout, reason, key);

    return { result, bet, net: payout - bet, account: settled.account, replayed: settled.replayed };
  }
}

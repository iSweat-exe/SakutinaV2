import { EconomyError } from "@/domain/economy/economy-error.ts";
import type { EconomyService } from "@/domain/economy/economy-service.ts";
import type { Account } from "@/domain/economy/economy-types.ts";
import { dealerPlay, deal, decidedAtDeal, doubleDown, isBust, outcomeOf, payoutOutcome, type Outcome, type Round } from "./blackjack.ts";
import { BET_CEILING, MIN_BET, WORST_NET, defaultCasinoSettings, secureRandom, type CasinoSettings, type Game, type Random } from "./casino-rules.ts";
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
  /** Cagnotte gagnée en plus (machine à sous, trois 7) ; 0 sinon. */
  jackpot: number;
  /** `true` si l'opération avait déjà été enregistrée (même interaction) : rien n'a été rejoué. */
  replayed: boolean;
}>;

/** Réglages du casino d'un serveur (ouverts ou fermés, mise maximale) ; sans eux, les valeurs par défaut. */
export type CasinoSettingsOf = (guildId: string) => Promise<CasinoSettings>;

export type BlackjackEnd = Readonly<{ outcome: Outcome; payout: number; bet: number; net: number; account: Account }>;

/**
 * Les jeux d'argent. Les règles et le tirage sont dans les fichiers de ce dossier (purs) ; ce service ne fait que
 * valider la mise et faire passer l'argent par l'économie, dans le grand livre, de façon atomique : les pertes vont au
 * compte du casino (5 % à la cagnotte du jackpot), qui paie les gains sans jamais passer sous zéro. La mise maximale
 * est la plus petite de celle réglée par le serveur et de celle que le compte du casino couvre. Jamais de sanction
 * Discord : un jeu ne touche qu'au portefeuille.
 */
export class CasinoService {
  constructor(
    private readonly economy: EconomyService,
    private readonly random: Random = secureRandom,
    private readonly settingsOf: CasinoSettingsOf = async () => defaultCasinoSettings(),
  ) {}

  /**
   * Refuse avant tout tirage une partie sur un jeu fermé par les administrateurs du serveur, une mise hors des limites
   * du jeu (minimum commun, maximum réglé par le serveur), ou que le compte du casino ne couvre pas (`casino_limit`).
   */
  async assertPlayable(guildId: string, game: Game, bet: number): Promise<void> {
    const rules = (await this.settingsOf(guildId))[game];

    if (!rules.enabled) {
      throw new EconomyError("game_closed", { game });
    }

    const max = Math.min(rules.maxBet, BET_CEILING);

    if (!Number.isSafeInteger(bet) || bet < MIN_BET || bet > max) {
      throw new EconomyError("bet_limits", { min: MIN_BET, max });
    }

    const covered = await this.economy.casinoBetCeiling(guildId, WORST_NET[game]);

    if (covered.closedToday || bet > covered.max) {
      throw new EconomyError("casino_limit", { max: covered.closedToday ? 0 : covered.max });
    }
  }

  async slots(guildId: string, memberId: string, bet: number, key: string): Promise<Played<SlotsResult>> {
    await this.assertPlayable(guildId, "slots", bet);
    const result = playSlots(this.random, bet);

    const jackpot = result.reels.every((symbol) => symbol === "seven");

    return this.finish(guildId, memberId, "slots", bet, result.payout, key, result, jackpot);
  }

  async coinflip(guildId: string, memberId: string, bet: number, side: Side, key: string): Promise<Played<CoinflipResult>> {
    await this.assertPlayable(guildId, "coinflip", bet);
    const result = flipCoin(this.random, side, bet);

    return this.finish(guildId, memberId, "coinflip", bet, result.payout, key, result);
  }

  async roulette(guildId: string, memberId: string, bet: number, on: RouletteBet, key: string): Promise<Played<RouletteResult>> {
    await this.assertPlayable(guildId, "roulette", bet);

    if (!isValidBet(on)) {
      throw new EconomyError("invalid_amount");
    }

    const result = spinRoulette(this.random, on, bet);

    return this.finish(guildId, memberId, "roulette", bet, result.payout, key, result);
  }

  /**
   * Début d'une main de blackjack : la mise quitte le portefeuille pour le compte du casino tout de suite (elle est en
   * jeu), puis les cartes sont distribuées. `gameId` identifie la main dans le grand livre.
   */
  async startBlackjack(guildId: string, memberId: string, bet: number, gameId: string): Promise<Round> {
    await this.assertPlayable(guildId, "blackjack", bet);
    await this.economy.casinoStake(guildId, memberId, bet, "casino:blackjack:bet", `bj:${gameId}:bet`, WORST_NET.blackjack);

    return deal(this.random, bet);
  }

  /**
   * « Doubler » : une seconde mise égale à la première quitte le portefeuille, une carte est tirée, la main s'arrête.
   * Le pire cas d'une main doublée était déjà couvert à la donne.
   */
  async doubleBlackjack(guildId: string, memberId: string, round: Round, gameId: string): Promise<Round> {
    await this.economy.casinoStake(guildId, memberId, round.bet, "casino:blackjack:double", `bj:${gameId}:double`, null);

    return doubleDown(round);
  }

  /** Fin d'une main : le croupier joue (sauf si le joueur a dépassé 21), puis le gain éventuel est versé. */
  async finishBlackjack(guildId: string, memberId: string, round: Round, gameId: string): Promise<BlackjackEnd & { round: Round }> {
    // Le croupier ne joue pas si le joueur a dépassé 21 ou si la main était décidée à la donne.
    const finished = isBust(round.player) || decidedAtDeal(round) ? round : dealerPlay(round);
    const outcome = outcomeOf(finished);
    const payout = payoutOutcome(outcome, finished.bet);

    if (payout > 0) {
      await this.economy.casinoReturn(guildId, memberId, payout, `casino:blackjack:${outcome}`, `bj:${gameId}:out`);
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
    game: Game,
    bet: number,
    payout: number,
    key: string,
    result: T,
    jackpot = false,
  ): Promise<Played<T>> {
    const settled = await this.economy.settle(guildId, memberId, bet, payout, `casino:${game}`, key, { maxNet: WORST_NET[game], jackpot });

    return { result, bet, net: payout - bet, account: settled.account, jackpot: settled.jackpot, replayed: settled.replayed };
  }
}

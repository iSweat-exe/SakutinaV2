import { describe, expect, test } from "bun:test";

import {
  RANKS,
  canDouble,
  dealerPlay,
  deal,
  decidedAtDeal,
  doubleDown,
  hit,
  isBlackjack,
  isBust,
  outcomeOf,
  payoutOutcome,
  playerCanAct,
  shuffledDeck,
  totalOf,
  type Card,
  type Round,
} from "@/domain/casino/blackjack.ts";

const c = (rank: Card["rank"], suit: Card["suit"] = "♠"): Card => ({ rank, suit });
const round = (player: Card[], dealer: Card[], deck: Card[] = [], bet = 100): Round => ({ deck, player, dealer, bet, doubled: false });

describe("valeur d'une main", () => {
  test("les figures valent 10, l'as 11 puis 1 pour ne pas dépasser 21", () => {
    expect(totalOf([c("K"), c("Q")])).toEqual({ total: 20, soft: false });
    expect(totalOf([c("A"), c("6")])).toEqual({ total: 17, soft: true });
    expect(totalOf([c("A"), c("6"), c("9")])).toEqual({ total: 16, soft: false });
    expect(totalOf([c("A"), c("A"), c("9")])).toEqual({ total: 21, soft: true });
    expect(totalOf([c("A"), c("A"), c("A"), c("A")])).toEqual({ total: 14, soft: true });
    expect(totalOf([c("10"), c("5"), c("9")]).total).toBe(24);
  });

  test("blackjack = 21 en deux cartes ; dépassement au-delà de 21", () => {
    expect(isBlackjack([c("A"), c("K")])).toBe(true);
    expect(isBlackjack([c("7"), c("7"), c("7")])).toBe(false);
    expect(isBust([c("10"), c("5"), c("9")])).toBe(true);
    expect(isBust([c("10"), c("5"), c("6")])).toBe(false);
  });
});

describe("le jeu et la donne", () => {
  test("52 cartes distinctes, mélangées de façon reproductible par le tirage", () => {
    const deck = shuffledDeck(() => 0.5);

    expect(deck).toHaveLength(52);
    expect(new Set(deck.map((card) => card.rank + card.suit)).size).toBe(52);
    expect(RANKS).toHaveLength(13);
    expect(shuffledDeck(() => 0.5)).toEqual(deck);
    expect(shuffledDeck(() => 0.1)).not.toEqual(deck);
  });

  test("la donne distribue en alternance : joueur, croupier, joueur, croupier", () => {
    const sorted = shuffledDeck(() => 0.999999);
    const dealt = deal(() => 0.999999, 50);

    expect(dealt.player).toEqual([sorted[0]!, sorted[2]!]);
    expect(dealt.dealer).toEqual([sorted[1]!, sorted[3]!]);
    expect(dealt.deck).toHaveLength(48);
    expect(dealt.bet).toBe(50);
    expect(dealt.doubled).toBe(false);
  });
});

describe("tirer, doubler, croupier", () => {
  test("tirer ajoute la prochaine carte du jeu", () => {
    const next = hit(round([c("5"), c("6")], [c("9"), c("8")], [c("K"), c("2")]));

    expect(next.player).toEqual([c("5"), c("6"), c("K")]);
    expect(next.deck).toEqual([c("2")]);
    expect(() => hit(round([], [], []))).toThrow("vide");
  });

  test("doubler double la mise, tire une carte et ferme la main ; permis seulement avec deux cartes", () => {
    const start = round([c("5"), c("6")], [c("9"), c("8")], [c("K")]);
    const doubled = doubleDown(start);

    expect(canDouble(start)).toBe(true);
    expect(doubled).toMatchObject({ bet: 200, doubled: true });
    expect(doubled.player).toHaveLength(3);
    expect(playerCanAct(doubled)).toBe(false);
    expect(canDouble(doubled)).toBe(false);
    expect(canDouble(hit(start))).toBe(false);
  });

  test("le joueur ne peut plus agir à 21 ou après un dépassement", () => {
    expect(playerCanAct(round([c("5"), c("6")], [c("9"), c("8")]))).toBe(true);
    expect(playerCanAct(round([c("7"), c("7"), c("7")], [c("9"), c("8")]))).toBe(false);
    expect(playerCanAct(round([c("10"), c("6"), c("9")], [c("9"), c("8")]))).toBe(false);
  });

  test("le croupier tire jusqu'à 17 et s'arrête sur tous les 17, même souples", () => {
    expect(dealerPlay(round([], [c("9"), c("6")], [c("5"), c("K")])).dealer).toEqual([c("9"), c("6"), c("5")]);
    expect(dealerPlay(round([], [c("A"), c("6")], [c("K")])).dealer).toEqual([c("A"), c("6")]);
    expect(dealerPlay(round([], [c("10"), c("7")], [c("K")])).dealer).toHaveLength(2);
    expect(dealerPlay(round([], [c("2"), c("3")], [c("4"), c("5"), c("6")])).dealer).toEqual([c("2"), c("3"), c("4"), c("5"), c("6")]);
    expect(() => dealerPlay(round([], [c("2"), c("3")], []))).toThrow("vide");
  });
});

describe("issue et gains", () => {
  const outcome = (player: Card[], dealer: Card[]) => outcomeOf(round(player, dealer));

  test("victoire, défaite, égalité, dépassement", () => {
    expect(outcome([c("10"), c("9")], [c("10"), c("8")])).toBe("win");
    expect(outcome([c("10"), c("8")], [c("10"), c("9")])).toBe("lose");
    expect(outcome([c("10"), c("8")], [c("9"), c("9")])).toBe("push");
    expect(outcome([c("10"), c("5"), c("9")], [c("10"), c("8")])).toBe("lose");
    expect(outcome([c("10"), c("2")], [c("10"), c("6"), c("9")])).toBe("win");
  });

  test("le dépassement du joueur perd même si le croupier dépasse aussi (il joue après)", () => {
    expect(outcome([c("10"), c("5"), c("9")], [c("10"), c("6"), c("9")])).toBe("lose");
  });

  test("blackjack naturel : paie 3 contre 2, égalité contre un blackjack du croupier ; un 21 en trois cartes ne l'est pas", () => {
    expect(outcome([c("A"), c("K")], [c("10"), c("9")])).toBe("blackjack");
    expect(outcome([c("A"), c("K")], [c("A"), c("Q")])).toBe("push");
    expect(outcome([c("7"), c("7"), c("7")], [c("10"), c("9")])).toBe("win");
    expect(outcome([c("7"), c("7"), c("7")], [c("A"), c("K")])).toBe("lose");
  });

  test("décidé dès la donne : blackjack du joueur ou du croupier", () => {
    expect(decidedAtDeal(round([c("A"), c("K")], [c("2"), c("3")]))).toBe(true);
    expect(decidedAtDeal(round([c("5"), c("6")], [c("A"), c("K")]))).toBe(true);
    expect(decidedAtDeal(round([c("5"), c("6")], [c("2"), c("3")]))).toBe(false);
  });

  test("gains, mise comprise : 2,5× un blackjack (arrondi à l'inférieur), 2× une victoire, la mise à égalité, rien sinon", () => {
    expect(payoutOutcome("blackjack", 100)).toBe(250);
    expect(payoutOutcome("blackjack", 15)).toBe(37);
    expect(payoutOutcome("win", 100)).toBe(200);
    expect(payoutOutcome("push", 100)).toBe(100);
    expect(payoutOutcome("lose", 100)).toBe(0);
  });

  test("une main doublée gagne le double : la mise totale est déjà doublée", () => {
    const doubled = doubleDown(round([c("5"), c("6")], [c("10"), c("7")], [c("10")], 100));

    expect(outcomeOf(doubled)).toBe("win");
    expect(payoutOutcome("win", doubled.bet)).toBe(400);
  });
});

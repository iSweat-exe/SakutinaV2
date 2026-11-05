import { randomInt, type Random } from "./casino-rules.ts";

export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;
export const SUITS = ["♠", "♥", "♦", "♣"] as const;

export type Card = Readonly<{ rank: (typeof RANKS)[number]; suit: (typeof SUITS)[number] }>;

export type Hand = readonly Card[];

/** Une partie : un seul jeu de 52 cartes par main, mélangé à chaque donne. */
export type Round = Readonly<{
  deck: readonly Card[];
  player: Hand;
  dealer: Hand;
  /** Mise totale engagée (doublée après un « double »). */
  bet: number;
  doubled: boolean;
}>;

export type Outcome = "blackjack" | "win" | "push" | "lose";

export type Total = Readonly<{ total: number; soft: boolean }>;

const cardValue = (card: Card): number => (card.rank === "A" ? 11 : ["J", "Q", "K"].includes(card.rank) ? 10 : Number(card.rank));

/** Valeur d'une main : les as valent 11 tant que cela ne fait pas dépasser 21, sinon 1. */
export function totalOf(hand: Hand): Total {
  let total = hand.reduce((sum, card) => sum + cardValue(card), 0);
  let aces = hand.filter((card) => card.rank === "A").length;

  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  return { total, soft: aces > 0 };
}

export const isBlackjack = (hand: Hand): boolean => hand.length === 2 && totalOf(hand).total === 21;
export const isBust = (hand: Hand): boolean => totalOf(hand).total > 21;

/** Un jeu de 52 cartes mélangé (Fisher-Yates). */
export function shuffledDeck(random: Random): Card[] {
  const deck = RANKS.flatMap((rank) => SUITS.map((suit) => ({ rank, suit })));

  for (let i = deck.length - 1; i > 0; i--) {
    const j = randomInt(random, i + 1);
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }

  return deck;
}

/** Distribue : deux cartes au joueur, deux au croupier (la deuxième reste cachée tant que la main est en jeu). */
export function deal(random: Random, bet: number): Round {
  const deck = shuffledDeck(random);

  return {
    deck: deck.slice(4),
    player: [deck[0]!, deck[2]!],
    dealer: [deck[1]!, deck[3]!],
    bet,
    doubled: false,
  };
}

/** Le joueur tire une carte. */
export function hit(round: Round): Round {
  const [card, ...deck] = round.deck;

  if (!card) {
    throw new Error("Le jeu est vide");
  }

  return { ...round, deck, player: [...round.player, card] };
}

/** Le joueur double sa mise, tire une seule carte, puis s'arrête. */
export function doubleDown(round: Round): Round {
  return { ...hit(round), bet: round.bet * 2, doubled: true };
}

/** Le croupier tire jusqu'à 17 ou plus (il s'arrête sur tous les 17, même « souples »). */
export function dealerPlay(round: Round): Round {
  let { deck, dealer } = round;

  while (totalOf(dealer).total < 17) {
    const [card, ...rest] = deck;

    if (!card) {
      throw new Error("Le jeu est vide");
    }

    deck = rest;
    dealer = [...dealer, card];
  }

  return { ...round, deck, dealer };
}

/**
 * Issue d'une main terminée. Un blackjack naturel paie 3 contre 2 ; un blackjack du croupier contre un joueur
 * qui n'en a pas est perdu d'avance (le croupier regarde sa carte cachée dès la donne).
 */
export function outcomeOf(round: Round): Outcome {
  const player = totalOf(round.player).total;
  const dealer = totalOf(round.dealer).total;

  if (isBlackjack(round.player) && !round.doubled) {
    return isBlackjack(round.dealer) ? "push" : "blackjack";
  }

  if (player > 21) return "lose";
  if (isBlackjack(round.dealer)) return "lose";
  if (dealer > 21 || player > dealer) return "win";

  return player === dealer ? "push" : "lose";
}

/** Combien le joueur récupère, mise comprise : 2,5× pour un blackjack, 2× pour une victoire, la mise pour une égalité. */
export function payoutOutcome(outcome: Outcome, bet: number): number {
  switch (outcome) {
    case "blackjack":
      return Math.floor((bet * 5) / 2);
    case "win":
      return bet * 2;
    case "push":
      return bet;
    case "lose":
      return 0;
  }
}

/** La main est-elle décidée dès la donne ? (blackjack du joueur ou du croupier) */
export const decidedAtDeal = (round: Round): boolean => isBlackjack(round.player) || isBlackjack(round.dealer);

/** Le joueur peut-il encore agir ? Il s'arrête de lui-même à 21 ou en cas de dépassement. */
export const playerCanAct = (round: Round): boolean => !round.doubled && totalOf(round.player).total < 21;

/** Le « double » n'est permis qu'avec les deux premières cartes. */
export const canDouble = (round: Round): boolean => round.player.length === 2 && !round.doubled;

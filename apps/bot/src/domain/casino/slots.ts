import { randomInt, type Random } from "./casino-rules.ts";

/** Les symboles d'un rouleau, avec leur poids (sur 100) : les plus rares paient le plus. */
export const SYMBOLS = [
  { id: "cherry", weight: 30 },
  { id: "lemon", weight: 25 },
  { id: "plum", weight: 20 },
  { id: "bell", weight: 15 },
  { id: "seven", weight: 10 },
] as const;

export type Symbol = (typeof SYMBOLS)[number]["id"];

const TOTAL_WEIGHT = SYMBOLS.reduce((sum, symbol) => sum + symbol.weight, 0);

/** Trois symboles identiques : multiple de la mise (mise comprise). */
export const TRIPLE: Readonly<Record<Symbol, number>> = { cherry: 6, lemon: 10, plum: 15, bell: 30, seven: 120 };

/** Exactement deux cerises, n'importe où : 1,6 fois la mise. */
export const TWO_CHERRIES = 1.6;

export type Reels = readonly [Symbol, Symbol, Symbol];

function draw(random: Random): Symbol {
  let pick = randomInt(random, TOTAL_WEIGHT);

  for (const symbol of SYMBOLS) {
    if (pick < symbol.weight) {
      return symbol.id;
    }

    pick -= symbol.weight;
  }

  return SYMBOLS[0].id;
}

/** Les trois rouleaux, tirés indépendamment. */
export function spinReels(random: Random): Reels {
  return [draw(random), draw(random), draw(random)];
}

/** Multiple de la mise que paient ces rouleaux ; 0 si rien ne paie. */
export function multiplierOf(reels: Reels): number {
  const [a, b, c] = reels;

  if (a === b && b === c) {
    return TRIPLE[a];
  }

  return reels.filter((symbol) => symbol === "cherry").length === 2 ? TWO_CHERRIES : 0;
}

/** Gain total : arrondi à l'inférieur, au profit du casino. */
export const payoutOf = (reels: Reels, bet: number): number => Math.floor(bet * multiplierOf(reels));

export type SlotsResult = Readonly<{ reels: Reels; payout: number }>;

export function playSlots(random: Random, bet: number): SlotsResult {
  const reels = spinReels(random);

  return { reels, payout: payoutOf(reels, bet) };
}

/** Rendement théorique pour une mise « ronde » (sans arrondi) : somme des gains pondérés par leur probabilité. */
export function theoreticalReturn(): number {
  let total = 0;

  for (const a of SYMBOLS) {
    for (const b of SYMBOLS) {
      for (const c of SYMBOLS) {
        const probability = (a.weight * b.weight * c.weight) / TOTAL_WEIGHT ** 3;
        total += probability * multiplierOf([a.id, b.id, c.id]);
      }
    }
  }

  return total;
}

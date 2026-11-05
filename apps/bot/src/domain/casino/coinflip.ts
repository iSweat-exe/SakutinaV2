import type { Random } from "./casino-rules.ts";

export const SIDES = ["heads", "tails"] as const;
export type Side = (typeof SIDES)[number];

/** Chance de gagner : légèrement sous la moitié, la marge du casino (rendement théorique de 98 %). */
export const WIN_CHANCE = 0.49;

export type CoinflipResult = Readonly<{ landed: Side; won: boolean; payout: number }>;

/**
 * Pile ou face : on gagne le double de sa mise avec 49 % de chances. La pièce affichée est cohérente avec le
 * résultat : elle tombe sur le côté choisi si l'on gagne, sur l'autre sinon.
 */
export function flipCoin(random: Random, side: Side, bet: number): CoinflipResult {
  const won = random() < WIN_CHANCE;
  const landed: Side = won ? side : side === "heads" ? "tails" : "heads";

  return { landed, won, payout: won ? bet * 2 : 0 };
}

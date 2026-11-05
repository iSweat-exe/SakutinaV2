import { randomInt, type Random } from "./casino-rules.ts";

/** Roulette européenne : 37 cases, de 0 à 36. Le 0 fait perdre toutes les mises extérieures. */
export const POCKETS = 37;

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export type Color = "red" | "black" | "green";

export const colorOf = (pocket: number): Color => (pocket === 0 ? "green" : RED.has(pocket) ? "red" : "black");

/** Ce sur quoi on mise : une couleur, la parité, une moitié du tapis, ou un numéro plein. */
export type RouletteBet =
  | Readonly<{ kind: "red" | "black" | "even" | "odd" | "low" | "high" }>
  | Readonly<{ kind: "number"; number: number }>;

export const isValidBet = (bet: RouletteBet): boolean =>
  bet.kind !== "number" || (Number.isInteger(bet.number) && bet.number >= 0 && bet.number <= 36);

/** Vrai si la case tirée fait gagner cette mise. */
export function wins(bet: RouletteBet, pocket: number): boolean {
  switch (bet.kind) {
    case "number":
      return pocket === bet.number;
    case "red":
    case "black":
      return colorOf(pocket) === bet.kind;
    case "even":
      return pocket !== 0 && pocket % 2 === 0;
    case "odd":
      return pocket % 2 === 1;
    case "low":
      return pocket >= 1 && pocket <= 18;
    case "high":
      return pocket >= 19;
  }
}

/** Gain total pour une mise : 35 contre 1 sur un numéro (36 fois la mise rendue), 1 contre 1 sinon (le double). */
export const payoutFor = (bet: RouletteBet, stake: number): number => stake * (bet.kind === "number" ? 36 : 2);

export type RouletteResult = Readonly<{ pocket: number; color: Color; won: boolean; payout: number }>;

export function spinRoulette(random: Random, bet: RouletteBet, stake: number): RouletteResult {
  const pocket = randomInt(random, POCKETS);
  const won = wins(bet, pocket);

  return { pocket, color: colorOf(pocket), won, payout: won ? payoutFor(bet, stake) : 0 };
}

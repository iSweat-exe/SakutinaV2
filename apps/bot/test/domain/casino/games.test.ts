import { describe, expect, test } from "bun:test";

import { MAX_BET, MIN_BET, randomInt, secureRandom } from "@/domain/casino/casino-rules.ts";
import { WIN_CHANCE, flipCoin } from "@/domain/casino/coinflip.ts";
import { POCKETS, colorOf, isValidBet, payoutFor, spinRoulette, wins, type RouletteBet } from "@/domain/casino/roulette.ts";
import { SYMBOLS, TRIPLE, TWO_CHERRIES, multiplierOf, payoutOf, playSlots, spinReels, theoreticalReturn, type Reels } from "@/domain/casino/slots.ts";

/** Un tirage choisi : renvoie ces valeurs dans l'ordre, puis la dernière en boucle. */
const sequence = (...values: number[]) => {
  let index = 0;

  return () => values[Math.min(index++, values.length - 1)]!;
};

describe("aléa", () => {
  test("secureRandom reste dans [0, 1) et randomInt dans [0, borne)", () => {
    for (let i = 0; i < 1_000; i++) {
      const value = secureRandom();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      expect(randomInt(secureRandom, 7)).toBeLessThan(7);
    }

    expect(randomInt(() => 0.9999999, 10)).toBe(9);
    expect(randomInt(() => 0, 10)).toBe(0);
  });

  test("les limites de mise sont cohérentes", () => {
    expect(MIN_BET).toBe(10);
    for (const max of Object.values(MAX_BET)) expect(max).toBeGreaterThan(MIN_BET);
    // La machine à sous, la moins favorable, est aussi la plus bridée après le pile ou face.
    expect(MAX_BET.slots).toBeLessThan(MAX_BET.blackjack);
  });
});

describe("machine à sous", () => {
  test("le rendement théorique est d'environ 96 %, sous 100 % (le casino gagne) et au-dessus de 90 % (le jeu reste attrayant)", () => {
    const rtp = theoreticalReturn();

    expect(rtp).toBeGreaterThan(0.94);
    expect(rtp).toBeLessThan(0.98);
  });

  test("les poids font 100 et les gains vont croissant avec la rareté du symbole", () => {
    expect(SYMBOLS.reduce((sum, symbol) => sum + symbol.weight, 0)).toBe(100);

    const byRarity = [...SYMBOLS].sort((a, b) => b.weight - a.weight).map((symbol) => TRIPLE[symbol.id]);
    expect(byRarity).toEqual([...byRarity].sort((a, b) => a - b));
  });

  test("trois identiques paient le multiple du symbole, exactement deux cerises 1,6×, le reste rien", () => {
    expect(multiplierOf(["seven", "seven", "seven"])).toBe(TRIPLE.seven);
    expect(multiplierOf(["lemon", "lemon", "lemon"])).toBe(TRIPLE.lemon);
    expect(multiplierOf(["cherry", "lemon", "cherry"])).toBe(TWO_CHERRIES);
    expect(multiplierOf(["lemon", "cherry", "cherry"])).toBe(TWO_CHERRIES);
    expect(multiplierOf(["cherry", "cherry", "cherry"])).toBe(TRIPLE.cherry);
    expect(multiplierOf(["cherry", "lemon", "plum"])).toBe(0);
    expect(multiplierOf(["lemon", "lemon", "plum"])).toBe(0);
  });

  test("le gain est arrondi à l'inférieur", () => {
    const reels: Reels = ["cherry", "cherry", "plum"];

    expect(payoutOf(reels, 10)).toBe(16);
    expect(payoutOf(reels, 15)).toBe(24);
    expect(payoutOf(reels, 11)).toBe(17);
    expect(payoutOf(["bell", "plum", "lemon"], 500)).toBe(0);
  });

  test("les rouleaux suivent le tirage : poids cumulés 30 / 55 / 75 / 90 / 100", () => {
    expect(spinReels(sequence(0, 0.299, 0.3))).toEqual(["cherry", "cherry", "lemon"]);
    expect(spinReels(sequence(0.55, 0.75, 0.9))).toEqual(["plum", "bell", "seven"]);
    expect(spinReels(sequence(0.9999999))).toEqual(["seven", "seven", "seven"]);
    expect(playSlots(sequence(0.95), 100)).toEqual({ reels: ["seven", "seven", "seven"], payout: 100 * TRIPLE.seven });
  });

  test("sur un grand nombre de tirages, le rendement mesuré reste proche du théorique", () => {
    let state = 12_345;
    const lcg = () => {
      state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
      return state / 4_294_967_296;
    };
    const spins = 200_000;
    let returned = 0;

    for (let i = 0; i < spins; i++) returned += playSlots(lcg, 100).payout;

    expect(returned / (spins * 100)).toBeGreaterThan(theoreticalReturn() - 0.05);
    expect(returned / (spins * 100)).toBeLessThan(theoreticalReturn() + 0.05);
  });
});

describe("pile ou face", () => {
  test("49 % de gagner, au double de la mise ; la pièce retombe sur le côté choisi seulement si l'on gagne", () => {
    expect(WIN_CHANCE).toBe(0.49);
    expect(flipCoin(() => 0.48, "heads", 100)).toEqual({ landed: "heads", won: true, payout: 200 });
    expect(flipCoin(() => 0.49, "heads", 100)).toEqual({ landed: "tails", won: false, payout: 0 });
    expect(flipCoin(() => 0.1, "tails", 50)).toEqual({ landed: "tails", won: true, payout: 100 });
    expect(flipCoin(() => 0.99, "tails", 50)).toEqual({ landed: "heads", won: false, payout: 0 });
  });

  test("rendement théorique de 98 %", () => {
    expect(WIN_CHANCE * 2).toBeCloseTo(0.98, 10);
  });
});

describe("roulette", () => {
  const all = Array.from({ length: POCKETS }, (_, pocket) => pocket);
  const count = (bet: RouletteBet) => all.filter((pocket) => wins(bet, pocket)).length;

  test("37 cases : 18 rouges, 18 noires, le 0 vert", () => {
    expect(all.filter((pocket) => colorOf(pocket) === "red")).toHaveLength(18);
    expect(all.filter((pocket) => colorOf(pocket) === "black")).toHaveLength(18);
    expect(colorOf(0)).toBe("green");
    expect(colorOf(1)).toBe("red");
    expect(colorOf(2)).toBe("black");
    expect(colorOf(36)).toBe("red");
  });

  test("chaque mise extérieure couvre 18 cases, un numéro une seule ; le 0 fait perdre les mises extérieures", () => {
    for (const kind of ["red", "black", "even", "odd", "low", "high"] as const) {
      expect(count({ kind })).toBe(18);
      expect(wins({ kind }, 0)).toBe(false);
    }

    expect(count({ kind: "number", number: 17 })).toBe(1);
    expect(wins({ kind: "number", number: 0 }, 0)).toBe(true);
    expect(wins({ kind: "low" }, 18)).toBe(true);
    expect(wins({ kind: "low" }, 19)).toBe(false);
    expect(wins({ kind: "high" }, 19)).toBe(true);
    expect(wins({ kind: "even" }, 36)).toBe(true);
    expect(wins({ kind: "odd" }, 35)).toBe(true);
  });

  test("rendement théorique de 36/37 sur un numéro et de 36/37 sur une mise extérieure (2,7 % pour le casino)", () => {
    const rtp = (bet: RouletteBet) => (count(bet) * payoutFor(bet, 1)) / POCKETS;

    expect(rtp({ kind: "red" })).toBeCloseTo(36 / 37, 10);
    expect(rtp({ kind: "number", number: 7 })).toBeCloseTo(36 / 37, 10);
  });

  test("gains : 36× la mise rendue sur un numéro (35 contre 1), 2× sur une mise extérieure", () => {
    expect(payoutFor({ kind: "number", number: 7 }, 10)).toBe(360);
    expect(payoutFor({ kind: "black" }, 10)).toBe(20);
  });

  test("un tirage donne la case, sa couleur et le gain", () => {
    expect(spinRoulette(() => 0, { kind: "red" }, 100)).toEqual({ pocket: 0, color: "green", won: false, payout: 0 });
    expect(spinRoulette(() => 1 / 37, { kind: "red" }, 100)).toEqual({ pocket: 1, color: "red", won: true, payout: 200 });
    expect(spinRoulette(() => 17.5 / 37, { kind: "number", number: 17 }, 10)).toEqual({ pocket: 17, color: "black", won: true, payout: 360 });
    expect(spinRoulette(() => 0.9999999, { kind: "high" }, 10).pocket).toBe(36);
  });

  test("un numéro doit être un entier de 0 à 36", () => {
    expect(isValidBet({ kind: "number", number: 0 })).toBe(true);
    expect(isValidBet({ kind: "number", number: 36 })).toBe(true);
    expect(isValidBet({ kind: "number", number: 37 })).toBe(false);
    expect(isValidBet({ kind: "number", number: -1 })).toBe(false);
    expect(isValidBet({ kind: "number", number: 1.5 })).toBe(false);
    expect(isValidBet({ kind: "red" })).toBe(true);
  });
});

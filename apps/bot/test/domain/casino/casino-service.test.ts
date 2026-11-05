import { describe, expect, test } from "bun:test";

import { MemoryEconomyStore } from "@/database/in-memory/memory-economy-store.ts";
import { MAX_BET, MIN_BET, type Random } from "@/domain/casino/casino-rules.ts";
import { CasinoService } from "@/domain/casino/casino-service.ts";
import { EconomyError } from "@/domain/economy/economy-error.ts";
import { EconomyService } from "@/domain/economy/economy-service.ts";

const GUILD = "g";
const ME = "m";

async function scene(funds = 1_000, random: Random = () => 0.5) {
  const economy = new EconomyService(new MemoryEconomyStore());
  await economy.grantStartingBalance(GUILD, ME, funds);
  const casino = new CasinoService(economy, random);
  let n = 0;
  const key = () => `k${n++}`;
  const wallet = async () => (await economy.getAccount(GUILD, ME)).wallet;

  return { economy, casino, key, wallet };
}

const refusal = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(EconomyError);
    return error as EconomyError;
  }

  throw new Error("expected a refusal");
};

describe("mises", () => {
  test("hors limites : refusé avant tout tirage, avec les bornes du jeu, sans rien écrire", async () => {
    let draws = 0;
    const { casino, key, wallet } = await scene(1_000, () => (draws++, 0.5));

    for (const [call, game] of [
      [() => casino.slots(GUILD, ME, MIN_BET - 1, key()), "slots"],
      [() => casino.slots(GUILD, ME, MAX_BET.slots + 1, key()), "slots"],
      [() => casino.coinflip(GUILD, ME, MAX_BET.coinflip + 1, "heads", key()), "coinflip"],
      [() => casino.roulette(GUILD, ME, 5, { kind: "red" }, key()), "roulette"],
      [() => casino.startBlackjack(GUILD, ME, MAX_BET.blackjack + 1, key()), "blackjack"],
      [() => casino.slots(GUILD, ME, 12.5, key()), "slots"],
    ] as const) {
      const error = await refusal(call());
      expect(error.code).toBe("bet_limits");
      expect(error.details).toEqual({ min: MIN_BET, max: MAX_BET[game] });
    }

    expect(draws).toBe(0);
    expect(await wallet()).toBe(1_000);
  });

  test("fonds insuffisants : refusé, rien n'est écrit", async () => {
    const { casino, key, wallet } = await scene(50);

    expect((await refusal(casino.slots(GUILD, ME, 100, key()))).code).toBe("insufficient_funds");
    expect((await refusal(casino.startBlackjack(GUILD, ME, 100, key()))).code).toBe("insufficient_funds");
    expect(await wallet()).toBe(50);
  });
});

describe("jeux à issue immédiate", () => {
  test("machine à sous : un gain net crédite, le tirage et le portefeuille concordent", async () => {
    // 0,95 trois fois : sept, sept, sept → 120 fois la mise.
    const { casino, key, wallet } = await scene(1_000, () => 0.95);
    const played = await casino.slots(GUILD, ME, 10, key());

    expect(played.result.reels).toEqual(["seven", "seven", "seven"]);
    expect(played.net).toBe(1_190);
    expect(played.account.wallet).toBe(2_190);
    expect(await wallet()).toBe(2_190);
    expect(played.replayed).toBe(false);
  });

  test("machine à sous : une perte débite la mise", async () => {
    // cerise (0), citron (0,3), prune (0,55) : rien ne paie.
    const draws = [0, 0.3, 0.55];
    let i = 0;
    const { casino, key, wallet } = await scene(1_000, () => draws[i++ % 3]!);

    expect((await casino.slots(GUILD, ME, 100, key())).net).toBe(-100);
    expect(await wallet()).toBe(900);
  });

  test("pile ou face : le côté tiré et le gain", async () => {
    const win = await scene(1_000, () => 0.1);
    const played = await win.casino.coinflip(GUILD, ME, 100, "tails", win.key());

    expect(played.result).toEqual({ landed: "tails", won: true, payout: 200 });
    expect(played.net).toBe(100);
    expect(await win.wallet()).toBe(1_100);

    const loss = await scene(1_000, () => 0.9);
    expect((await loss.casino.coinflip(GUILD, ME, 100, "tails", loss.key())).result.landed).toBe("heads");
    expect(await loss.wallet()).toBe(900);
  });

  test("roulette : mise extérieure gagnante ou perdante, numéro plein, numéro invalide refusé", async () => {
    const red = await scene(1_000, () => 1 / 37);
    expect((await red.casino.roulette(GUILD, ME, 100, { kind: "red" }, red.key())).net).toBe(100);

    const zero = await scene(1_000, () => 0);
    expect((await zero.casino.roulette(GUILD, ME, 100, { kind: "red" }, zero.key())).net).toBe(-100);

    const plein = await scene(1_000, () => 17.5 / 37);
    const played = await plein.casino.roulette(GUILD, ME, 10, { kind: "number", number: 17 }, plein.key());
    expect(played.result.pocket).toBe(17);
    expect(played.net).toBe(350);

    expect((await refusal(plein.casino.roulette(GUILD, ME, 10, { kind: "number", number: 40 }, plein.key()))).code).toBe("invalid_amount");
  });

  test("la même interaction rejouée ne s'applique qu'une fois", async () => {
    const { casino, wallet } = await scene(1_000, () => 0.9);

    const first = await casino.coinflip(GUILD, ME, 100, "heads", "same");
    const again = await casino.coinflip(GUILD, ME, 100, "heads", "same");

    expect(first.replayed).toBe(false);
    expect(again.replayed).toBe(true);
    expect(await wallet()).toBe(900);
  });

  test("le grand livre porte le jeu et le résultat", async () => {
    const { economy, casino, key } = await scene(1_000, () => 0.1);
    await casino.coinflip(GUILD, ME, 100, "heads", key());

    expect((await economy.history(GUILD, ME, 1))[0]).toMatchObject({ kind: "earn", amount: 100, reason: "casino:coinflip:win" });
  });
});

describe("blackjack", () => {
  test("la mise quitte le portefeuille au début, le gain est versé à la fin, mise comprise", async () => {
    // Tirage constant : jeu mélangé identique, on ne dépend pas des cartes précises ici.
    const { casino, wallet } = await scene(1_000, () => 0.5);
    const round = await casino.startBlackjack(GUILD, ME, 100, "game-1");

    expect(await wallet()).toBe(900);
    expect(round.bet).toBe(100);
    expect(round.player).toHaveLength(2);

    const end = await casino.finishBlackjack(GUILD, ME, round, "game-1");

    expect(end.payout).toBe({ blackjack: 250, win: 200, push: 100, lose: 0 }[end.outcome]);
    expect(await wallet()).toBe(900 + end.payout);
    expect(end.net).toBe(end.payout - 100);
  });

  test("doubler : une seconde mise est prélevée, la mise totale double, le gain suit", async () => {
    const { casino, wallet } = await scene(1_000, () => 0.5);
    const round = await casino.startBlackjack(GUILD, ME, 100, "game-2");
    const doubled = await casino.doubleBlackjack(GUILD, ME, round, "game-2");

    expect(doubled.bet).toBe(200);
    expect(doubled.doubled).toBe(true);
    expect(await wallet()).toBe(800);

    const end = await casino.finishBlackjack(GUILD, ME, doubled, "game-2");
    expect(await wallet()).toBe(800 + end.payout);
  });

  test("doubler sans les fonds : refusé, la main reste inchangée", async () => {
    const { casino, wallet } = await scene(150, () => 0.5);
    const round = await casino.startBlackjack(GUILD, ME, 100, "game-3");

    expect((await refusal(casino.doubleBlackjack(GUILD, ME, round, "game-3"))).code).toBe("insufficient_funds");
    expect(await wallet()).toBe(50);
  });

  test("terminer deux fois la même main ne verse qu'un gain", async () => {
    const { casino, wallet } = await scene(1_000, () => 0.5);
    const round = await casino.startBlackjack(GUILD, ME, 100, "game-4");

    const first = await casino.finishBlackjack(GUILD, ME, round, "game-4");
    await casino.finishBlackjack(GUILD, ME, round, "game-4");

    expect(await wallet()).toBe(900 + first.payout);
  });
});

describe("trésor", () => {
  test("une mise perdue va au trésor du serveur", async () => {
    const { economy, casino, key } = await scene(1_000, () => 0.99);

    await casino.coinflip(GUILD, ME, 100, "heads", key());

    expect(await economy.treasury(GUILD)).toBe(100);
  });

  test("blackjack : la mise va au trésor au début, le gain en est payé à la fin", async () => {
    const { economy, casino, wallet } = await scene(1_000);
    const round = await casino.startBlackjack(GUILD, ME, 100, "bj-treasury");

    expect(await economy.treasury(GUILD)).toBe(100);
    expect(await wallet()).toBe(900);

    const end = await casino.finishBlackjack(GUILD, ME, round, "bj-treasury");

    // Quel que soit le résultat, ce que le trésor garde est la mise moins ce qu'il a versé (jamais négatif).
    expect(await economy.treasury(GUILD)).toBe(Math.max(0, 100 - end.payout));
    expect(await wallet()).toBe(900 + end.payout);
  });
});

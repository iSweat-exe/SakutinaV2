import { PGlite } from "@electric-sql/pglite";
import { afterAll, describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/pglite";

import type { Database } from "@/database/postgres/connection.ts";
import { migrate } from "@/database/postgres/migrate.ts";
import { PostgresEconomyStore } from "@/database/postgres/repositories/postgres-economy-store.ts";
import { MemoryEconomyStore } from "@/database/in-memory/memory-economy-store.ts";
import { EconomyService } from "@/domain/economy/economy-service.ts";
import type { EconomyStore } from "@/domain/economy/economy-store.ts";
import { EconomyError } from "@/domain/economy/economy-error.ts";
import {
  ARRIVAL_ENDOWMENT,
  CASINO_SEED,
  CASINO_SHARES,
  DAILY_COOLDOWN_MS,
  DAILY_STREAK_CAP,
  DAILY_STREAK_WINDOW_MS,
  GENESIS_RESERVE,
  MAX_BALANCE,
  WORK_COOLDOWN_MS,
} from "@/domain/economy/economy-rules.ts";
import type { PoolMove } from "@/domain/economy/pools.ts";
import { dailyShare, workShare } from "@/domain/economy/salary.ts";
import { type LedgerEntry } from "@/domain/economy/economy-types.ts";

const pglite = new PGlite();
const database = drizzle(pglite) as unknown as Database;
await migrate(database);
afterAll(async () => {
  await pglite.close();
});

// Un mercredi : le passage hebdomadaire n'a lieu que le dimanche.
let now = new Date("2026-11-04T12:00:00.000Z");
const clock = () => now;
const advance = (ms: number) => {
  now = new Date(now.getTime() + ms);
};
const DAY = 24 * 3_600_000;
/** Budget des salaires utilisé par les tests : 10 ‰ de la réserve par jour (la valeur par défaut). */
const BUDGET = 10;
/** Réserve d'un serveur neuf : la dotation de lancement moins l'apport du casino. */
const FRESH_RESERVE = GENESIS_RESERVE - CASINO_SEED;

const stores: [string, () => EconomyStore][] = [
  ["mémoire", () => new MemoryEconomyStore()],
  ["PostgreSQL (PGlite)", () => new PostgresEconomyStore(database)],
];

async function rejection(promise: Promise<unknown>): Promise<EconomyError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(EconomyError);
    return error as EconomyError;
  }

  throw new Error("expected the operation to be refused");
}

/** Somme signée des mouvements : doit reconstituer exactement les soldes. */
function replay(entries: readonly LedgerEntry[]) {
  let wallet = 0;
  let bank = 0;

  for (const entry of [...entries].reverse()) {
    if (entry.kind === "earn") wallet += entry.amount;
    if (entry.kind === "spend") wallet -= entry.amount;
    if (entry.kind === "deposit") {
      wallet -= entry.amount;
      bank += entry.amount;
    }
    if (entry.kind === "withdraw") {
      wallet += entry.amount;
      bank -= entry.amount;
    }
  }

  return { wallet, bank };
}

/**
 * Écriture directe dans le stockage (pour préparer un test) : le portefeuille du membre change de `wallet`, et les
 * caisses de `moves`. Le stockage vérifie quand même qu'aucune caisse ne passe sous zéro.
 */
async function raw(store: EconomyStore, guildId: string, memberId: string, wallet: number, moves: readonly PoolMove[] = []) {
  const key = `raw-${crypto.randomUUID()}`;

  return store.transact(guildId, memberId, key, (account) => ({
    account: { ...account, wallet: account.wallet + wallet },
    entry: {
      id: crypto.randomUUID(),
      guildId,
      memberId,
      kind: wallet >= 0 ? "earn" : "spend",
      amount: Math.max(1, Math.abs(wallet)),
      walletAfter: account.wallet + wallet,
      bankAfter: account.bank,
      reason: "test",
      idempotencyKey: key,
      createdAt: now,
    },
    pools: { moves },
  }));
}

for (const [label, createStore] of stores) {
  describe(`économie — ${label}`, () => {
    /** Un serveur neuf par test (la base PGlite est partagée) : ses caisses partent de la dotation de lancement. */
    const setup = (random = () => 0) => {
      const store = createStore();
      const service = new EconomyService(store, clock, random);
      const guild = `g-${crypto.randomUUID()}`;
      const member = crypto.randomUUID();
      let sequence = 0;
      const key = () => `${member}:${sequence++}`;
      /** Verse `amount` de la réserve au portefeuille de `memberId` (sans passer par les salaires). */
      const fund = (memberId: string, amount: number) => raw(store, guild, memberId, amount, [{ pool: "reserve", amount: -amount, reason: "test" }]);
      /** Toutes les pièces du serveur : comptes, réserve, casino, jackpot. */
      const held = async (members: readonly string[]) => {
        const pools = await service.pools(guild);
        const accounts = await Promise.all(members.map((id) => service.getAccount(guild, id)));

        return pools.reserve + pools.casino + pools.jackpot + accounts.reduce((sum, account) => sum + account.wallet + account.bank, 0);
      };

      return { store, service, guild, member, key, fund, held };
    };

    test("un compte inconnu est vide, un serveur neuf a sa dotation de lancement et son casino", async () => {
      const { service, guild, member } = setup();

      expect(await service.getAccount(guild, member)).toMatchObject({ wallet: 0, bank: 0, shares: 0, lastWorkAt: null });
      expect(await service.history(guild, member)).toEqual([]);
      expect(await service.pools(guild)).toMatchObject({
        reserve: FRESH_RESERVE,
        casino: CASINO_SEED,
        jackpot: 0,
        shares: CASINO_SHARES,
        float: CASINO_SHARES,
      });
    });

    describe("salaires", () => {
      test("work verse une part du budget du jour, prise dans la réserve, entre 50 et 150 % de la part moyenne", async () => {
        const low = setup(() => 0);
        const high = setup(() => 0.999999);
        const budget = Math.floor((FRESH_RESERVE * BUDGET) / 1000);

        const first = await low.service.work(low.guild, low.member, low.key(), BUDGET);
        const second = await high.service.work(high.guild, high.member, high.key(), BUDGET);

        expect(first.entry.amount).toBe(workShare(budget, 1, () => 0));
        expect(second.entry.amount).toBe(workShare(budget, 1, () => 0.999999));
        expect(second.entry.amount).toBe(3 * first.entry.amount);
        expect(first.entry).toMatchObject({ kind: "earn", reason: "work", walletAfter: first.entry.amount });
        expect((await low.service.pools(low.guild)).reserve).toBe(FRESH_RESERVE - first.entry.amount);
      });

      test("work est limité par un délai, puis de nouveau possible", async () => {
        const { service, guild, member, key } = setup();

        const once = await service.work(guild, member, key(), BUDGET);
        const refused = await rejection(service.work(guild, member, key(), BUDGET));

        expect(refused.code).toBe("cooldown");
        expect(refused.details.remainingMs).toBe(WORK_COOLDOWN_MS);

        advance(WORK_COOLDOWN_MS - 1_000);
        expect((await rejection(service.work(guild, member, key(), BUDGET))).details.remainingMs).toBe(1_000);

        advance(1_000);
        await service.work(guild, member, key(), BUDGET);
        expect((await service.getAccount(guild, member)).wallet).toBe(2 * once.entry.amount);
      });

      test("daily : 40 % du budget partagé entre les actifs, +5 % par jour de série, délai et reprise à zéro", async () => {
        const { service, guild, member, key } = setup();
        const expected = async (streak: number) => {
          const { reserve } = await service.pools(guild);

          return dailyShare(Math.floor((reserve * BUDGET) / 1000), 1, streak);
        };

        const firstAmount = await expected(1);
        const first = await service.daily(guild, member, key(), BUDGET);
        expect(first.entry).toMatchObject({ kind: "earn", reason: "daily", amount: firstAmount });
        expect(firstAmount).toBe(Math.floor((FRESH_RESERVE * BUDGET) / 1000 * 0.4));
        expect(first.account.dailyStreak).toBe(1);

        const refused = await rejection(service.daily(guild, member, key(), BUDGET));
        expect(refused.code).toBe("cooldown");
        expect(refused.details.remainingMs).toBe(DAILY_COOLDOWN_MS);

        advance(DAY);
        const secondAmount = await expected(2);
        const second = await service.daily(guild, member, key(), BUDGET);
        expect(second.account.dailyStreak).toBe(2);
        expect(second.entry.amount).toBe(secondAmount);

        advance(DAILY_STREAK_WINDOW_MS + 1);
        const resetAmount = await expected(1);
        const reset = await service.daily(guild, member, key(), BUDGET);
        expect(reset.account.dailyStreak).toBe(1);
        expect(reset.entry.amount).toBe(resetAmount);
      });

      test("daily : le bonus de série est plafonné et la même clé ne s'applique qu'une fois", async () => {
        const { service, guild, member, key } = setup();
        let last = await service.daily(guild, member, key(), BUDGET);

        for (let day = 0; day < DAILY_STREAK_CAP + 3; day++) {
          advance(DAY);
          const { reserve } = await service.pools(guild);
          last = await service.daily(guild, member, key(), BUDGET);
          expect(last.entry.amount).toBe(dailyShare(Math.floor((reserve * BUDGET) / 1000), 1, Math.min(last.account.dailyStreak, DAILY_STREAK_CAP)));
        }

        expect(last.account.dailyStreak).toBe(DAILY_STREAK_CAP + 4);

        advance(DAY);
        const sameKey = key();
        const once = await service.daily(guild, member, sameKey, BUDGET);
        const again = await service.daily(guild, member, sameKey, BUDGET);
        expect(again.replayed).toBe(true);
        expect(again.entry.id).toBe(once.entry.id);
      });

      test("le budget du jour ne se dépasse jamais : le dernier reçoit le reste, le suivant rien", async () => {
        const { service, guild } = setup();
        const budget = Math.floor((FRESH_RESERVE * 1) / 1000);
        const members = Array.from({ length: 4 }, () => crypto.randomUUID());
        const paid: number[] = [];

        for (const member of members.slice(0, 3)) {
          paid.push((await service.daily(guild, member, `d-${member}`, 1)).entry.amount);
        }

        // 1 membre actif connu en début de journée : chacun vise 40 % du budget, le troisième n'a que le reste.
        expect(paid).toEqual([Math.floor(budget * 0.4), Math.floor(budget * 0.4), budget - 2 * Math.floor(budget * 0.4)]);
        const refused = await rejection(service.daily(guild, members[3]!, `d-${members[3]}`, 1));
        expect(refused.code).toBe("salary_exhausted");
        // Refus : pas de délai, rien d'écrit.
        expect(await service.getAccount(guild, members[3]!)).toMatchObject({ wallet: 0, lastDailyAt: null });
        expect((await service.pools(guild)).reserve).toBe(FRESH_RESERVE - budget);
      });

      test("le lendemain, le budget est partagé entre les membres actifs des 7 derniers jours", async () => {
        const { service, guild } = setup();
        const [a, b] = [crypto.randomUUID(), crypto.randomUUID()];

        await service.daily(guild, a, `a-1`, BUDGET);
        await service.daily(guild, b, `b-1`, BUDGET);
        advance(DAY);

        const { reserve } = await service.pools(guild);
        const second = await service.daily(guild, a, `a-2`, BUDGET);

        expect(second.entry.amount).toBe(dailyShare(Math.floor((reserve * BUDGET) / 1000), 2, 2));
        expect((await service.pools(guild)).salary).toMatchObject({ active: 2 });
      });

      test("un budget nul ne verse rien : salary_exhausted", async () => {
        const { service, guild, member, key } = setup();

        expect((await rejection(service.work(guild, member, key(), 0))).code).toBe("salary_exhausted");
        expect((await rejection(service.daily(guild, member, key(), 0))).code).toBe("salary_exhausted");
        expect(await service.history(guild, member)).toEqual([]);
      });
    });

    test("deposit et withdraw déplacent l'argent, tout ou partie", async () => {
      const { service, guild, member, key, fund } = setup();
      await fund(member, 50);

      await service.deposit(guild, member, 20, key());
      expect(await service.getAccount(guild, member)).toMatchObject({ wallet: 30, bank: 20 });

      await service.deposit(guild, member, "all", key());
      expect(await service.getAccount(guild, member)).toMatchObject({ wallet: 0, bank: 50 });

      await service.withdraw(guild, member, 15, key());
      await service.withdraw(guild, member, "all", key());
      expect(await service.getAccount(guild, member)).toMatchObject({ wallet: 50, bank: 0 });
    });

    test("un refus n'écrit rien (fonds insuffisants, « tout » à zéro, montants invalides)", async () => {
      const { service, guild, member, key, fund } = setup();
      await fund(member, 50);
      const before = await service.history(guild, member, 100);

      const tooMuch = await rejection(service.deposit(guild, member, 51, key()));
      expect(tooMuch.code).toBe("insufficient_funds");
      expect(tooMuch.details.available).toBe(50);
      expect((await rejection(service.withdraw(guild, member, "all", key()))).code).toBe("insufficient_funds");

      for (const amount of [0, -5, 1.5, Number.NaN, Number.POSITIVE_INFINITY, MAX_BALANCE + 1]) {
        expect((await rejection(service.deposit(guild, member, amount, key()))).code).toBe("invalid_amount");
      }

      expect(await service.history(guild, member, 100)).toEqual(before);
      expect((await service.getAccount(guild, member)).wallet).toBe(50);
    });

    test("la même clé d'idempotence ne s'applique qu'une fois", async () => {
      const { service, guild, member, key, fund } = setup();
      await fund(member, 50);

      const idempotencyKey = key();
      const first = await service.deposit(guild, member, 10, idempotencyKey);
      const again = await service.deposit(guild, member, 10, idempotencyKey);

      expect(first.replayed).toBe(false);
      expect(again.replayed).toBe(true);
      expect(again.entry.id).toBe(first.entry.id);
      expect(await service.getAccount(guild, member)).toMatchObject({ wallet: 40, bank: 10 });
    });

    test("des opérations simultanées ne rendent jamais un solde négatif ni ne dupliquent un work", async () => {
      const { service, guild, member, key, fund } = setup();
      const attempts = await Promise.allSettled(Array.from({ length: 10 }, () => service.work(guild, member, key(), BUDGET)));
      expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);

      const other = crypto.randomUUID();
      await fund(other, 50);
      // 50 en portefeuille : 10 dépôts simultanés de 10 → au plus 5 réussissent.
      const deposits = await Promise.allSettled(Array.from({ length: 10 }, () => service.deposit(guild, other, 10, `${other}:${crypto.randomUUID()}`)));
      expect(deposits.filter((deposit) => deposit.status === "fulfilled")).toHaveLength(5);
      expect(await service.getAccount(guild, other)).toMatchObject({ wallet: 0, bank: 50 });
    });

    test("le grand livre reconstitue exactement les soldes", async () => {
      const { service, guild, member, key } = setup(() => 0.5);

      await service.work(guild, member, key(), BUDGET);
      await service.deposit(guild, member, 40, key());
      await service.withdraw(guild, member, 15, key());
      advance(WORK_COOLDOWN_MS);
      await service.work(guild, member, key(), BUDGET);
      await service.deposit(guild, member, "all", key());

      const account = await service.getAccount(guild, member);
      const entries = await service.history(guild, member, 100);

      expect(entries).toHaveLength(5);
      expect(replay(entries)).toEqual({ wallet: account.wallet, bank: account.bank });
      expect(entries[0]).toMatchObject({ walletAfter: account.wallet, bankAfter: account.bank });
    });

    test("le plafond de solde est respecté", async () => {
      const { store, service, guild, member } = setup();
      await raw(store, guild, member, MAX_BALANCE);

      expect((await rejection(service.work(guild, member, "k1", BUDGET))).code).toBe("balance_limit");

      await service.deposit(guild, member, MAX_BALANCE, "k2");
      await service.work(guild, member, "k3", BUDGET);
      expect((await rejection(service.withdraw(guild, member, "all", "k4"))).code).toBe("balance_limit");
    });

    test("leaderboard classe par richesse totale et exclut les comptes vides", async () => {
      const { service, guild, fund } = setup();

      await fund("poor", 10);
      await fund("rich", 1000);
      await service.deposit(guild, "rich", 900, "rich-bank");
      await fund("middle", 500);

      expect((await service.leaderboard(guild, 10)).map((account) => account.memberId)).toEqual(["rich", "middle", "poor"]);
      expect((await service.leaderboard(guild, 2)).map((account) => account.memberId)).toEqual(["rich", "middle"]);
      expect(await service.leaderboard(`vide-${crypto.randomUUID()}`, 10)).toEqual([]);
    });

    test("arrivée : la réserve reçoit la dotation une seule fois, puis paie le solde de départ une seule fois", async () => {
      const { service, guild, member } = setup();

      expect(await service.welcome(guild, member, 0)).toBeNull();
      expect((await service.pools(guild)).reserve).toBe(FRESH_RESERVE + ARRIVAL_ENDOWMENT);

      expect((await service.welcome(guild, member, 300))?.replayed).toBe(false);
      // Le membre quitte puis revient : ni nouvelle dotation, ni nouveau solde de départ.
      expect((await service.welcome(guild, member, 300))?.replayed).toBe(true);
      expect((await service.getAccount(guild, member)).wallet).toBe(300);
      expect((await service.pools(guild)).reserve).toBe(FRESH_RESERVE + ARRIVAL_ENDOWMENT - 300);
      expect(await service.history(guild, member)).toHaveLength(1);
    });

    describe("pay", () => {
      test("le destinataire reçoit le montant moins la taxe (arrondie à l'inférieur) ; la taxe va à la réserve", async () => {
        const { service, guild, member: payer, key, fund, held } = setup();
        const payee = crypto.randomUUID();
        await fund(payer, 1000);
        const before = await held([payer, payee]);

        const result = await service.pay(guild, payer, payee, 333, 10, key());

        expect(result.tax).toBe(33);
        expect(result.received).toBe(300);
        expect((await service.getAccount(guild, payer)).wallet).toBe(667);
        expect((await service.getAccount(guild, payee)).wallet).toBe(300);
        expect((await service.pools(guild)).reserve).toBe(FRESH_RESERVE - 1000 + 33);
        expect(await held([payer, payee])).toBe(before);
      });

      test("le même paiement rejoué ne s'applique qu'une fois ; un refus n'écrit rien", async () => {
        const { service, guild, member: payer, fund } = setup();
        const payee = crypto.randomUUID();
        await fund(payer, 1000);
        const key = `pay-${crypto.randomUUID()}`;

        await service.pay(guild, payer, payee, 400, 5, key);
        expect((await service.pay(guild, payer, payee, 400, 5, key)).from.replayed).toBe(true);
        expect((await service.getAccount(guild, payer)).wallet).toBe(600);
        expect((await service.getAccount(guild, payee)).wallet).toBe(380);

        expect((await rejection(service.pay(guild, payer, payee, 601, 0, `p-${crypto.randomUUID()}`))).code).toBe("insufficient_funds");
        expect((await rejection(service.pay(guild, payer, payer, 10, 0, `p-${crypto.randomUUID()}`))).code).toBe("self_transfer");
        expect((await service.pools(guild)).reserve).toBe(FRESH_RESERVE - 1000 + 20);
      });
    });

    describe("casino", () => {
      test("une perte va au casino, sauf 5 % pour le jackpot ; un gain est payé par le casino ; une égalité n'écrit rien", async () => {
        const { service, guild, member, key, fund } = setup();
        await fund(member, 1000);

        const loss = await service.settle(guild, member, 100, 0, "casino:slots", key(), { maxNet: 119 });
        expect(loss.entry).toMatchObject({ kind: "spend", amount: 100, reason: "casino:slots:loss" });
        expect(await service.pools(guild)).toMatchObject({ casino: CASINO_SEED + 95, jackpot: 5 });

        const win = await service.settle(guild, member, 100, 250, "casino:roulette", key(), { maxNet: 35 });
        expect(win.entry).toMatchObject({ kind: "earn", amount: 150, reason: "casino:roulette:win" });
        expect((await service.pools(guild)).casino).toBe(CASINO_SEED + 95 - 150);

        const push = await service.settle(guild, member, 100, 100, "casino:coinflip", key(), { maxNet: 1 });
        expect(push.entry).toBeNull();
        expect((await service.getAccount(guild, member)).wallet).toBe(1050);
        expect(await service.history(guild, member)).toHaveLength(3);
      });

      test("trois 7 remportent la cagnotte entière, payée par le jackpot et non par le casino", async () => {
        const { service, guild, member, key, fund } = setup();
        await fund(member, 10_000);

        for (let round = 0; round < 10; round += 1) {
          await service.settle(guild, member, 80, 0, "casino:slots", key(), { maxNet: 119 });
        }

        const before = await service.pools(guild);
        expect(before.jackpot).toBe(40);
        const won = await service.settle(guild, member, 10, 1200, "casino:slots", key(), { maxNet: 119, jackpot: true });

        expect(won.jackpot).toBe(40);
        expect(won.entry).toMatchObject({ kind: "earn", amount: 1190 + 40, reason: "casino:slots:jackpot" });
        expect(await service.pools(guild)).toMatchObject({ jackpot: 0, casino: before.casino - 1190 });
      });

      test("la mise est refusée avant tout si le casino ne la couvre pas (1 % du compte, pire gain sous 20 %)", async () => {
        const { service, guild, member, key, fund } = setup();
        await fund(member, 10_000);

        // Pile ou face : 1 % de 100 000. Machine à sous : 20 % de 100 000 / 119.
        expect(await service.casinoBetCeiling(guild, 1)).toEqual({ max: 1000, closedToday: false });
        expect((await service.casinoBetCeiling(guild, 119)).max).toBe(168);

        const refused = await rejection(service.settle(guild, member, 169, 0, "casino:slots", key(), { maxNet: 119 }));
        expect(refused).toMatchObject({ code: "casino_limit", details: { max: 168 } });
        expect((await service.getAccount(guild, member)).wallet).toBe(10_000);
        expect((await service.pools(guild)).casino).toBe(CASINO_SEED);
      });

      test("le casino ferme pour la journée quand il a perdu 10 % de son solde du matin, et rouvre le lendemain", async () => {
        const { service, guild, member, key, fund } = setup();
        await fund(member, 100_000);

        // 20 gains nets de 500 au pile ou face : 10 % de 100 000.
        for (let round = 0; round < 20; round += 1) {
          await service.settle(guild, member, 500, 1000, "casino:coinflip", key(), { maxNet: 1 });
        }

        expect((await service.casinoBetCeiling(guild, 1)).closedToday).toBe(true);
        expect((await rejection(service.settle(guild, member, 10, 0, "casino:coinflip", key(), { maxNet: 1 }))).code).toBe("casino_limit");

        advance(DAY);
        expect((await service.casinoBetCeiling(guild, 1)).closedToday).toBe(false);
      });

      test("blackjack : la mise entre au casino, le gain en sort (puis de la réserve si besoin), jamais au-delà", async () => {
        const { service, guild, member, key, fund } = setup();
        await fund(member, 1000);

        await service.casinoStake(guild, member, 200, "casino:blackjack:bet", key(), 2);
        expect((await service.pools(guild)).casino).toBe(CASINO_SEED + 200);

        const returned = await service.casinoReturn(guild, member, 500, "casino:blackjack:blackjack", key());
        expect(returned.entry).toMatchObject({ kind: "earn", amount: 500 });
        expect((await service.pools(guild)).casino).toBe(CASINO_SEED - 300);
        expect((await service.getAccount(guild, member)).wallet).toBe(1300);
      });

      test("aucune partie ne crée ni ne détruit une pièce", async () => {
        const { service, guild, member, key, fund, held } = setup();
        await fund(member, 5000);
        const before = await held([member]);

        await service.settle(guild, member, 100, 0, "casino:slots", key(), { maxNet: 119 });
        await service.settle(guild, member, 77, 0, "casino:roulette", key(), { maxNet: 35 });
        await service.settle(guild, member, 100, 3600, "casino:roulette", key(), { maxNet: 35 });
        await service.casinoStake(guild, member, 300, "casino:blackjack:bet", key(), 2);
        await service.casinoReturn(guild, member, 750, "casino:blackjack:blackjack", key());

        expect(await held([member])).toBe(before);
      });
    });

    describe("action Casino", () => {
      test("acheter : au cours (compte du casino par action), plus 1 % de frais, payés à la réserve ; le cours ne bouge pas", async () => {
        const { service, guild, member, key, fund } = setup();
        await fund(member, 10_000);

        const bought = await service.buyShares(guild, member, 10, key());

        // 100 000 / 1 000 = 100 par action : 1 000, plus 10 de frais.
        expect(bought).toMatchObject({ shares: 10, value: 1000, fee: 10, priceCents: 10_000 });
        expect(bought.account).toMatchObject({ wallet: 8990, shares: 10 });
        expect(await service.pools(guild)).toMatchObject({ reserve: FRESH_RESERVE - 10_000 + 1010, casino: CASINO_SEED, float: 990 });
        expect((await service.market(guild)).priceCents).toBe(10_000);
      });

      test("vendre : au cours, moins 1 % de frais, payé par la réserve ; les actions reviennent au serveur", async () => {
        const { service, guild, member, key, fund } = setup();
        await fund(member, 10_000);
        await service.buyShares(guild, member, 10, key());

        const sold = await service.sellShares(guild, member, 4, key());

        expect(sold).toMatchObject({ shares: 4, value: 400, fee: 4 });
        expect(sold.account).toMatchObject({ wallet: 8990 + 396, shares: 6 });
        expect((await service.pools(guild)).float).toBe(994);
      });

      test("refus : plus d'actions que disponibles, fonds insuffisants, réserve trop basse pour racheter", async () => {
        const { store, service, guild, member, key, fund } = setup();
        await fund(member, 1000);

        expect((await rejection(service.sellShares(guild, member, 1, key()))).code).toBe("shares_unavailable");
        expect((await rejection(service.buyShares(guild, member, CASINO_SHARES + 1, key()))).code).toBe("shares_unavailable");
        expect((await rejection(service.buyShares(guild, member, 10, key()))).code).toBe("insufficient_funds");

        await service.buyShares(guild, member, 5, key());
        // La réserve est vidée (versée à un autre membre) : elle ne peut plus racheter.
        const { reserve } = await service.pools(guild);
        await raw(store, guild, "sink", reserve, [{ pool: "reserve", amount: -reserve, reason: "test" }]);
        expect((await rejection(service.sellShares(guild, member, 5, key()))).code).toBe("reserve_short");
        expect((await service.getAccount(guild, member)).shares).toBe(5);
      });

      test("perdre exprès au casino ne rapporte jamais, même avec toutes les actions", async () => {
        const { service, guild, member, key, fund } = setup();
        await fund(member, 200_000);
        await service.buyShares(guild, member, CASINO_SHARES, key());

        const worth = async () => {
          const [account, pools] = await Promise.all([service.getAccount(guild, member), service.pools(guild)]);

          return account.wallet + Math.floor((account.shares * pools.casino) / pools.shares);
        };
        const before = await worth();

        for (let round = 0; round < 5; round += 1) {
          await service.settle(guild, member, 500, 0, "casino:coinflip", key(), { maxNet: 1 });
        }

        // Le casino ne garde que 95 % de chaque perte : l'actionnaire unique y perd 5 %.
        expect(await worth()).toBe(before - 125);
        expect((await service.market(guild)).priceCents).toBe(Math.floor(((CASINO_SEED + 2375) * 100) / CASINO_SHARES));
      });

      test("le cours suit le compte du casino et garde sa trace par période de 15 min", async () => {
        const { service, guild, member, key, fund } = setup();
        await fund(member, 1000);

        await service.settle(guild, member, 1000, 0, "casino:coinflip", key(), { maxNet: 1 });
        advance(DAY + 15 * 60_000);

        expect(await service.market(guild)).toMatchObject({
          priceCents: Math.floor(((CASINO_SEED + 950) * 100) / CASINO_SHARES),
          dayAgoCents: Math.floor(((CASINO_SEED + 950) * 100) / CASINO_SHARES),
        });
      });
    });

    describe("passage du dimanche", () => {
      const sunday = () => {
        const day = now.getUTCDay();
        advance(((7 - day) % 7 || 7) * DAY);
      };

      test("rien un autre jour que le dimanche, une seule fois par semaine", async () => {
        const { service, guild } = setup();

        if (now.getUTCDay() === 0) advance(DAY);
        expect(await service.weekly(guild, 5, 20)).toBeNull();

        sunday();
        expect(await service.weekly(guild, 5, 20)).not.toBeNull();
        expect(await service.weekly(guild, 5, 20)).toBeNull();
      });

      test("impôt sur la fortune : seulement au-delà du seuil, au taux des actifs ou des inactifs, versé à la réserve", async () => {
        const { service, guild, fund, held, key } = setup();
        const [small, active, idle] = ["small", "active", "idle"];
        await fund(small, 1000);
        await fund(active, 100_000);
        await fund(idle, 100_000);
        sunday();
        advance(15 * DAY);
        sunday();
        // « active » a fait une opération récente ; « idle » non.
        await service.deposit(guild, active, 10, key());
        const before = await held([small, active, idle]);

        const run = await service.weekly(guild, 5, 20);

        // Médiane 100 000 : le seuil est 300 000, personne n'est imposé.
        expect(run).toMatchObject({ threshold: 300_000, wealthTax: 0, taxes: [] });

        await fund("whale", 600_000);
        advance(7 * DAY);
        const second = await service.weekly(guild, 5, 20);
        // Médiane (1 000, 100 000, 100 000, 600 000) = 100 000 : la baleine, active (elle vient de recevoir), paie
        // 0,5 % de ce qui dépasse 300 000 ; « idle », inactif depuis plus de 14 jours, reste sous le seuil.
        expect(second).toMatchObject({ threshold: 300_000, wealthTax: 1500 });
        expect((await service.getAccount(guild, "whale")).wallet).toBe(598_500);

        // Trois semaines sans opération : la baleine paie maintenant au taux des inactifs (2 %).
        advance(21 * DAY);
        const idleRun = await service.weekly(guild, 5, 20);
        expect(idleRun?.taxes.find((tax) => tax.memberId === "whale")).toEqual({ memberId: "whale", fromWallet: Math.floor((598_500 - 300_000) * 0.02), fromBank: 0 });
        expect(await held([small, active, idle, "whale"])).toBe(before);
      });

      test("dividendes : 20 % du bénéfice de la semaine aux actionnaires, 30 % à la réserve, pertes reportées", async () => {
        const { service, guild, member, key, fund, held } = setup();
        await fund(member, 20_000);
        await service.buyShares(guild, member, 100, key());
        const loser = "loser";
        await fund(loser, 50_000);

        // Le casino gagne 9 500 (10 pertes de 1 000, 5 % au jackpot).
        for (let round = 0; round < 10; round += 1) {
          await service.settle(guild, loser, 1000, 0, "casino:coinflip", `${loser}:${round}`, { maxNet: 1 });
        }

        sunday();
        const before = await held([member, loser]);
        const run = await service.weekly(guild, 0, 0);

        expect(run).toMatchObject({ profit: 9500, dividendsTotal: 1900, serverDividend: 1710, casinoTax: 2850, carriedLoss: 0 });
        expect(run?.dividends).toEqual([{ memberId: member, amount: 190 }]);
        expect(await held([member, loser])).toBe(before);

        // Une semaine perdante : pas de dividende, la perte est reportée sur la suivante.
        const winner = "winner";
        await fund(winner, 10_000);
        await service.settle(guild, winner, 1000, 2000, "casino:coinflip", "w-1", { maxNet: 1 });
        advance(7 * DAY);
        expect(await service.weekly(guild, 0, 0)).toMatchObject({ profit: 0, dividendsTotal: 0, carriedLoss: 1000 });
      });
    });

    describe("intérêts de la banque", () => {
      /** Un serveur dont la réserve contient `reserve` pièces, et des membres avec `banks` en banque depuis plus de 24 h. */
      const bank = async (banks: number[], reserve: number) => {
        const context = setup();
        const members: string[] = [];

        for (const amount of banks) {
          const member = crypto.randomUUID();
          await context.fund(member, amount);
          await context.service.deposit(context.guild, member, amount, context.key());
          members.push(member);
        }

        // Le reste de la réserve part chez un membre sans banque, qui ne touche pas d'intérêts.
        const { reserve: left } = await context.service.pools(context.guild);
        await context.fund("sink", left - reserve);
        advance(DAY + 3_600_000);

        return { ...context, members };
      };

      test("la banque rapporte au taux du serveur, payée par la réserve, en une écriture « interest » au portefeuille", async () => {
        const { service, guild, members } = await bank([10_000], 4_000);

        expect(await service.accrueInterest(guild, 10)).toEqual({ members: 1, wanted: 100, paid: 100 });
        expect(await service.getAccount(guild, members[0]!)).toMatchObject({ wallet: 100, bank: 10_000 });
        expect((await service.pools(guild)).reserve).toBe(3_900);
        expect((await service.history(guild, members[0]!))[0]).toMatchObject({ kind: "earn", amount: 100, reason: "interest" });
        expect(await service.accrueInterest(guild, 10)).toBeNull();
      });

      test("la réserve ne verse jamais plus du quart de son solde ; vide, elle ne verse rien", async () => {
        const low = await bank([10_000, 10_000], 400);

        expect(await low.service.accrueInterest(low.guild, 10)).toEqual({ members: 2, wanted: 200, paid: 100 });
        expect((await low.service.pools(low.guild)).reserve).toBe(300);

        const empty = await bank([10_000], 0);
        expect(await empty.service.accrueInterest(empty.guild, 10)).toEqual({ members: 0, wanted: 100, paid: 0 });
        expect((await empty.service.getAccount(empty.guild, empty.members[0]!)).wallet).toBe(0);
      });

      test("les intérêts ne créent rien : la somme des comptes et des caisses ne change pas", async () => {
        const { service, guild, members, held } = await bank([10_000, 7_000, 3_000], 4_000);
        const before = await held([...members, "sink"]);

        await service.accrueInterest(guild, 50);

        expect(await held([...members, "sink"])).toBe(before);
      });
    });

    test("/me forget : le solde retourne à la réserve, les actions au serveur, l'historique disparaît", async () => {
      const { service, guild, member, key, fund, held } = setup();
      await fund(member, 5000);
      await service.buyShares(guild, member, 10, key());
      await service.deposit(guild, member, 1000, key());
      const before = await held([member]);

      expect(await service.forget(guild, member)).toEqual({ returned: 3990, shares: 10 });

      expect(await service.getAccount(guild, member)).toMatchObject({ wallet: 0, bank: 0, shares: 0 });
      expect(await service.history(guild, member)).toEqual([]);
      expect((await service.pools(guild)).float).toBe(CASINO_SHARES);
      expect(await held([member])).toBe(before);
    });
  });
}

describe("PostgreSQL — garde-fous du schéma", () => {
  test("le grand livre est immuable, sauf pour le membre qui demande l'effacement, dans sa transaction", async () => {
    const service = new EconomyService(new PostgresEconomyStore(database), clock, () => 0);
    const [member, other] = [crypto.randomUUID(), crypto.randomUUID()];
    await service.work("guild", member, `${member}:0`, BUDGET);
    await service.work("guild", other, `${other}:0`, BUDGET);

    await expect(pglite.query("UPDATE economy_ledger SET amount = 999 WHERE member_id = $1", [member])).rejects.toThrow("immutable");
    await expect(pglite.query("DELETE FROM economy_ledger WHERE member_id = $1", [member])).rejects.toThrow("immutable");
    // L'autorisation d'un membre ne vaut pas pour un autre.
    await expect(
      pglite.transaction(async (tx) => {
        await tx.query("SELECT set_config('sakutina.forget', $1, true)", [`guild:${member}`]);
        await tx.query("DELETE FROM economy_ledger WHERE member_id = $1", [other]);
      }),
    ).rejects.toThrow("immutable");
    await expect(pglite.query("UPDATE treasury_entry SET amount = 1 WHERE guild_id = 'guild'")).rejects.toThrow("immutable");
    await expect(pglite.query("DELETE FROM casino_entry WHERE guild_id = 'guild'")).rejects.toThrow("immutable");
  });

  test("la base refuse un solde négatif, une caisse négative et un montant nul", async () => {
    const member = crypto.randomUUID();
    await pglite.query("INSERT INTO economy_account (guild_id, member_id) VALUES ('guild', $1)", [member]);

    await expect(pglite.query("UPDATE economy_account SET wallet = -1 WHERE member_id = $1", [member])).rejects.toThrow();
    await expect(pglite.query("UPDATE economy_account SET casino_shares = -1 WHERE member_id = $1", [member])).rejects.toThrow();
    await expect(pglite.query("UPDATE casino_fund SET balance = -1 WHERE guild_id = 'guild'")).rejects.toThrow();
    await expect(pglite.query("UPDATE casino_fund SET server_shares = shares + 1 WHERE guild_id = 'guild'")).rejects.toThrow();
    await expect(
      pglite.query(
        `INSERT INTO economy_ledger (id, guild_id, member_id, kind, amount, wallet_after, bank_after, reason, idempotency_key, created_at)
         VALUES ($1, 'guild', $2, 'earn', 0, 0, 0, 'x', 'zero', now())`,
        [crypto.randomUUID(), member],
      ),
    ).rejects.toThrow();
  });

  test("un trésor neuf naît avec sa dotation de lancement journalisée et ouvre le casino avec son apport", async () => {
    const guild = `genesis-${crypto.randomUUID()}`;
    await pglite.query("INSERT INTO guild_treasury (guild_id) VALUES ($1)", [guild]);

    const reserve = await pglite.query<{ balance: number }>("SELECT balance FROM guild_treasury WHERE guild_id = $1", [guild]);
    const fund = await pglite.query<{ balance: number; server_shares: number }>("SELECT balance, server_shares FROM casino_fund WHERE guild_id = $1", [guild]);
    const entries = await pglite.query<{ amount: number; reason: string }>(
      "SELECT amount, reason FROM treasury_entry WHERE guild_id = $1 ORDER BY seq",
      [guild],
    );

    expect(Number(reserve.rows[0]!.balance)).toBe(FRESH_RESERVE);
    expect(fund.rows.map((row) => [Number(row.balance), Number(row.server_shares)])).toEqual([[CASINO_SEED, CASINO_SHARES]]);
    expect(entries.rows.map((row) => [Number(row.amount), row.reason])).toEqual([
      [GENESIS_RESERVE, "genesis"],
      [-CASINO_SEED, "casino:seed"],
    ]);
  });

  test("RLS est activé sur les tables d'économie", async () => {
    const tables = ["economy_account", "economy_ledger", "casino_fund", "casino_entry", "market_candle", "economy_week_run"];
    const result = await pglite.query<{ relrowsecurity: boolean }>("SELECT relrowsecurity FROM pg_class WHERE relname = ANY($1)", [tables]);

    expect(result.rows).toHaveLength(tables.length);
    expect(result.rows.every((row) => row.relrowsecurity)).toBe(true);
  });
});

describe("invariant : l'économie ne touche jamais à Discord", () => {
  test("aucun fichier de domain/economy n'importe discord.js", async () => {
    const directory = new URL("../../../src/domain/economy/", import.meta.url);
    const files = [...new Bun.Glob("*.ts").scanSync({ cwd: fileURLToPath(directory) })];

    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const source = await Bun.file(new URL(file, directory)).text();
      expect(source).not.toContain("discord.js");
    }
  });
});

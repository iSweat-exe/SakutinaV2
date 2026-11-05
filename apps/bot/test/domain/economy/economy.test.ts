import { PGlite } from "@electric-sql/pglite";
import { afterAll, describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/pglite";

import type { Database } from "@/database/postgres/connection.ts";
import { migrate } from "@/database/postgres/migrate.ts";
import { PostgresEconomyStore } from "@/database/postgres/repositories/postgres-economy-store.ts";
import { EconomyService } from "@/domain/economy/economy-service.ts";
import type { EconomyStore } from "@/domain/economy/economy-store.ts";
import { EconomyError } from "@/domain/economy/economy-error.ts";
import {
  DAILY_BASE_REWARD,
  DAILY_COOLDOWN_MS,
  DAILY_STREAK_BONUS,
  DAILY_STREAK_CAP,
  DAILY_STREAK_WINDOW_MS,
} from "@/domain/economy/economy-rules.ts";
import { MAX_BALANCE, WORK_COOLDOWN_MS, WORK_MAX_REWARD, WORK_MIN_REWARD } from "@/domain/economy/economy-rules.ts";
import { type LedgerEntry } from "@/domain/economy/economy-types.ts";
import { MemoryEconomyStore } from "@/database/in-memory/memory-economy-store.ts";

const pglite = new PGlite();
const database = drizzle(pglite) as unknown as Database;
await migrate(database);
afterAll(async () => {
  await pglite.close();
});

let now = new Date("2026-11-04T12:00:00.000Z");
const clock = () => now;
const advance = (ms: number) => {
  now = new Date(now.getTime() + ms);
};

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

for (const [label, createStore] of stores) {
  describe(`économie — ${label}`, () => {
    const guild = "guild";
    const setup = (random = () => 0) => {
      const service = new EconomyService(createStore(), clock, random);
      const member = crypto.randomUUID();
      let sequence = 0;
      const key = () => `${member}:${sequence++}`;

      return { service, member, key };
    };

    test("un compte inconnu est vide", async () => {
      const { service, member } = setup();

      expect(await service.getAccount(guild, member)).toMatchObject({
        wallet: 0,
        bank: 0,
        lastWorkAt: null,
      });
      expect(await service.history(guild, member)).toEqual([]);
    });

    test("work crédite une récompense dans les bornes et enregistre le grand livre", async () => {
      const low = setup(() => 0);
      const high = setup(() => 0.999999);

      const first = await low.service.work(guild, low.member, low.key());
      const second = await high.service.work(guild, high.member, high.key());

      expect(first.entry.amount).toBe(WORK_MIN_REWARD);
      expect(second.entry.amount).toBe(WORK_MAX_REWARD);
      expect(first.account.wallet).toBe(WORK_MIN_REWARD);
      expect(first.entry).toMatchObject({ kind: "earn", reason: "work", walletAfter: 50 });
      expect(await low.service.history(guild, low.member)).toHaveLength(1);
    });

    test("work est limité par un délai, puis de nouveau possible", async () => {
      const { service, member, key } = setup();

      await service.work(guild, member, key());
      const refused = await rejection(service.work(guild, member, key()));

      expect(refused.code).toBe("cooldown");
      expect(refused.details.remainingMs).toBe(WORK_COOLDOWN_MS);

      advance(WORK_COOLDOWN_MS - 1_000);
      expect((await rejection(service.work(guild, member, key()))).details.remainingMs).toBe(1_000);

      advance(1_000);
      await service.work(guild, member, key());
      expect((await service.getAccount(guild, member)).wallet).toBe(2 * WORK_MIN_REWARD);
    });

    test("deposit et withdraw déplacent l'argent, tout ou partie", async () => {
      const { service, member, key } = setup();
      await service.work(guild, member, key()); // 50

      await service.deposit(guild, member, 20, key());
      expect(await service.getAccount(guild, member)).toMatchObject({ wallet: 30, bank: 20 });

      await service.deposit(guild, member, "all", key());
      expect(await service.getAccount(guild, member)).toMatchObject({ wallet: 0, bank: 50 });

      await service.withdraw(guild, member, 15, key());
      await service.withdraw(guild, member, "all", key());
      expect(await service.getAccount(guild, member)).toMatchObject({ wallet: 50, bank: 0 });
    });

    test("un refus n'écrit rien (fonds insuffisants, « tout » à zéro)", async () => {
      const { service, member, key } = setup();
      await service.work(guild, member, key());
      const before = await service.history(guild, member, 100);

      const tooMuch = await rejection(service.deposit(guild, member, 51, key()));
      expect(tooMuch.code).toBe("insufficient_funds");
      expect(tooMuch.details.available).toBe(50);
      expect((await rejection(service.withdraw(guild, member, "all", key()))).code).toBe(
        "insufficient_funds",
      );
      expect((await rejection(service.spend(guild, member, 51, "achat", key()))).code).toBe(
        "insufficient_funds",
      );

      expect(await service.history(guild, member, 100)).toEqual(before);
      expect((await service.getAccount(guild, member)).wallet).toBe(50);
    });

    test("les montants invalides sont refusés", async () => {
      const { service, member, key } = setup();

      for (const amount of [0, -5, 1.5, Number.NaN, Number.POSITIVE_INFINITY, MAX_BALANCE + 1]) {
        expect((await rejection(service.deposit(guild, member, amount, key()))).code).toBe(
          "invalid_amount",
        );
        expect((await rejection(service.spend(guild, member, amount, "x", key()))).code).toBe(
          "invalid_amount",
        );
      }
    });

    test("spend retire du portefeuille et trace le motif", async () => {
      const { service, member, key } = setup();
      await service.work(guild, member, key());

      const result = await service.spend(guild, member, 30, "boutique", key());

      expect(result.account.wallet).toBe(20);
      expect(result.entry).toMatchObject({ kind: "spend", amount: 30, reason: "boutique" });
    });

    test("la même clé d'idempotence ne s'applique qu'une fois", async () => {
      const { service, member, key } = setup();
      await service.work(guild, member, key());

      const idempotencyKey = key();
      const first = await service.deposit(guild, member, 10, idempotencyKey);
      const replayed = await service.deposit(guild, member, 10, idempotencyKey);

      expect(first.replayed).toBe(false);
      expect(replayed.replayed).toBe(true);
      expect(replayed.entry.id).toBe(first.entry.id);
      expect(await service.getAccount(guild, member)).toMatchObject({ wallet: 40, bank: 10 });
      expect(await service.history(guild, member, 100)).toHaveLength(2);
    });

    test("des opérations simultanées ne rendent jamais un solde négatif ni ne dupliquent un work", async () => {
      const { service, member, key } = setup();
      const attempts = await Promise.allSettled(
        Array.from({ length: 10 }, () => service.work(guild, member, key())),
      );
      expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);

      // 50 en portefeuille : 10 dépôts simultanés de 10 → au plus 5 réussissent.
      const deposits = await Promise.allSettled(
        Array.from({ length: 10 }, () => service.deposit(guild, member, 10, key())),
      );
      expect(deposits.filter((deposit) => deposit.status === "fulfilled")).toHaveLength(5);
      expect(await service.getAccount(guild, member)).toMatchObject({ wallet: 0, bank: 50 });
    });

    test("le grand livre reconstitue exactement les soldes", async () => {
      const { service, member, key } = setup(() => 0.5);

      await service.work(guild, member, key());
      await service.deposit(guild, member, 40, key());
      await service.withdraw(guild, member, 15, key());
      await service.spend(guild, member, 7, "achat", key());
      advance(WORK_COOLDOWN_MS);
      await service.work(guild, member, key());
      await service.deposit(guild, member, "all", key());

      const account = await service.getAccount(guild, member);
      const entries = await service.history(guild, member, 100);

      expect(entries).toHaveLength(6);
      expect(replay(entries)).toEqual({ wallet: account.wallet, bank: account.bank });
      expect(entries[0]).toMatchObject({
        walletAfter: account.wallet,
        bankAfter: account.bank,
      });
    });

    test("le plafond de solde est respecté", async () => {
      const store = createStore();
      const service = new EconomyService(store, clock, () => 0);
      const member = crypto.randomUUID();

      // Remplit le portefeuille jusqu'au plafond directement via le store.
      await store.transact(guild, member, "seed", (account) => ({
        account: { ...account, wallet: MAX_BALANCE },
        entry: {
          id: crypto.randomUUID(),
          guildId: guild,
          memberId: member,
          kind: "earn",
          amount: MAX_BALANCE,
          walletAfter: MAX_BALANCE,
          bankAfter: 0,
          reason: "seed",
          idempotencyKey: "seed",
          createdAt: now,
        },
      }));

      expect((await rejection(service.work(guild, member, "k1"))).code).toBe("balance_limit");

      await service.deposit(guild, member, MAX_BALANCE, "k2");
      await service.work(guild, member, "k3");
      // Retirer toute la banque dépasserait le plafond du portefeuille.
      expect((await rejection(service.withdraw(guild, member, "all", "k4"))).code).toBe(
        "balance_limit",
      );
    });

    test("daily : récompense, délai, série et reprise à zéro", async () => {
      const { service, member, key } = setup();

      const first = await service.daily(guild, member, key());
      expect(first.entry).toMatchObject({ kind: "earn", reason: "daily", amount: DAILY_BASE_REWARD });
      expect(first.account.dailyStreak).toBe(1);

      const refused = await rejection(service.daily(guild, member, key()));
      expect(refused.code).toBe("cooldown");
      expect(refused.details.remainingMs).toBe(DAILY_COOLDOWN_MS);

      advance(DAILY_COOLDOWN_MS);
      const second = await service.daily(guild, member, key());
      expect(second.account.dailyStreak).toBe(2);
      expect(second.entry.amount).toBe(DAILY_BASE_REWARD + DAILY_STREAK_BONUS);

      // Au-delà de la fenêtre de série, on repart de 1.
      advance(DAILY_STREAK_WINDOW_MS + 1);
      const reset = await service.daily(guild, member, key());
      expect(reset.account.dailyStreak).toBe(1);
      expect(reset.entry.amount).toBe(DAILY_BASE_REWARD);
    });

    test("daily : le bonus de série est plafonné et la même clé ne s'applique qu'une fois", async () => {
      const { service, member, key } = setup();
      let last = await service.daily(guild, member, key());

      for (let day = 0; day < DAILY_STREAK_CAP + 3; day++) {
        advance(DAILY_COOLDOWN_MS);
        last = await service.daily(guild, member, key());
      }

      expect(last.account.dailyStreak).toBe(DAILY_STREAK_CAP + 4);
      expect(last.entry.amount).toBe(DAILY_BASE_REWARD + DAILY_STREAK_BONUS * (DAILY_STREAK_CAP - 1));

      advance(DAILY_COOLDOWN_MS);
      const sameKey = key();
      const once = await service.daily(guild, member, sameKey);
      const replay = await service.daily(guild, member, sameKey);
      expect(replay.replayed).toBe(true);
      expect(replay.entry.id).toBe(once.entry.id);
    });

    test("leaderboard classe par richesse totale et exclut les comptes vides", async () => {
      const store = createStore();
      const service = new EconomyService(store, clock, () => 0);
      const g = `board-${crypto.randomUUID()}`;
      const [rich, middle, poor, empty] = ["rich", "middle", "poor", "empty"];

      const grant = async (memberId: string, wallet: number, bank: number) => {
        await store.transact(g, memberId, `seed-${memberId}`, (account) => ({
          account: { ...account, wallet, bank },
          entry: {
            id: crypto.randomUUID(),
            guildId: g,
            memberId,
            kind: "earn",
            amount: Math.max(1, wallet + bank),
            walletAfter: wallet,
            bankAfter: bank,
            reason: "seed",
            idempotencyKey: `seed-${memberId}`,
            createdAt: now,
          },
        }));
      };

      await grant(poor!, 10, 0);
      await grant(rich!, 100, 900);
      await grant(middle!, 500, 0);
      await grant(empty!, 0, 0);

      const board = await service.leaderboard(g, 10);

      expect(board.map((account) => account.memberId)).toEqual(["rich", "middle", "poor"]);
      expect((await service.leaderboard(g, 2)).map((account) => account.memberId)).toEqual(["rich", "middle"]);
      expect(await service.leaderboard(`vide-${crypto.randomUUID()}`, 10)).toEqual([]);
    });

    test("deux membres ont des comptes indépendants", async () => {
      const { service, member, key } = setup();
      const other = crypto.randomUUID();

      await service.work(guild, member, key());

      expect((await service.getAccount(guild, member)).wallet).toBe(50);
      expect((await service.getAccount(guild, other)).wallet).toBe(0);
      expect(await service.history(guild, other)).toEqual([]);
    });

    test("daily : la récompense de base vient des réglages du serveur, le bonus de série s'y ajoute", async () => {
      const { service, member, key } = setup();

      expect((await service.daily(guild, member, key(), 500)).entry.amount).toBe(500);
      advance(DAILY_COOLDOWN_MS);
      expect((await service.daily(guild, member, key(), 500)).entry.amount).toBe(500 + DAILY_STREAK_BONUS);
    });

    test("solde de départ : offert une seule fois par membre, rien si le montant est nul", async () => {
      const { service, member } = setup();

      expect(await service.grantStartingBalance(guild, member, 0)).toBeNull();
      expect((await service.grantStartingBalance(guild, member, 300))?.account.wallet).toBe(300);
      // Le membre quitte puis revient : la clé du membre est déjà connue, rien n'est ajouté.
      const again = await service.grantStartingBalance(guild, member, 300);
      expect(again?.replayed).toBe(true);
      expect((await service.getAccount(guild, member)).wallet).toBe(300);
      expect(await service.history(guild, member)).toHaveLength(1);
    });

    describe("pay", () => {
      const pair = async (funds: number) => {
        const { service, member: payer, key } = setup();
        const payee = crypto.randomUUID();
        await service.grantStartingBalance(guild, payer, funds);

        return { service, payer, payee, key };
      };

      test("le destinataire reçoit le montant moins la taxe (arrondie à l'inférieur) ; la taxe sort de la circulation", async () => {
        const { service, payer, payee, key } = await pair(1000);
        const result = await service.pay(guild, payer, payee, 333, 10, key());

        expect(result.tax).toBe(33);
        expect(result.received).toBe(300);
        expect((await service.getAccount(guild, payer)).wallet).toBe(667);
        expect((await service.getAccount(guild, payee)).wallet).toBe(300);
        expect(result.from.entry).toMatchObject({ kind: "spend", amount: 333 });
        expect(result.to.entry).toMatchObject({ kind: "earn", amount: 300 });
        // Circulation : 1000 au départ, 33 détruits.
        expect(replay(await service.history(guild, payer)).wallet + replay(await service.history(guild, payee)).wallet).toBe(967);
      });

      test("une taxe nulle ne prélève rien", async () => {
        const { service, payer, payee, key } = await pair(100);
        const result = await service.pay(guild, payer, payee, 100, 0, key());

        expect(result.tax).toBe(0);
        expect((await service.getAccount(guild, payee)).wallet).toBe(100);
      });

      test("le même paiement rejoué ne s'applique qu'une fois", async () => {
        const { service, payer, payee } = await pair(1000);
        const key = `pay-${crypto.randomUUID()}`;

        const first = await service.pay(guild, payer, payee, 400, 5, key);
        const replayed = await service.pay(guild, payer, payee, 400, 5, key);

        expect(first.from.replayed).toBe(false);
        expect(replayed.from.replayed).toBe(true);
        expect((await service.getAccount(guild, payer)).wallet).toBe(600);
        expect((await service.getAccount(guild, payee)).wallet).toBe(380);
      });

      test("fonds insuffisants, montant invalide, soi-même : refusé, rien n'est écrit", async () => {
        const { service, payer, payee, key } = await pair(50);

        expect((await rejection(service.pay(guild, payer, payee, 51, 0, key()))).code).toBe("insufficient_funds");
        expect((await rejection(service.pay(guild, payer, payee, 0, 0, key()))).code).toBe("invalid_amount");
        expect((await rejection(service.pay(guild, payer, payer, 10, 0, key()))).code).toBe("self_transfer");
        expect((await service.getAccount(guild, payer)).wallet).toBe(50);
        expect((await service.getAccount(guild, payee)).wallet).toBe(0);
        expect(await service.history(guild, payee)).toEqual([]);
      });
    });

    describe("jeux d'argent", () => {
      const funded = async (funds: number) => {
        const { service, member, key } = setup();
        await service.grantStartingBalance(guild, member, funds);

        return { service, member, key };
      };

      test("settle : un gain net s'écrit en earn, une perte nette en spend, une égalité n'écrit rien", async () => {
        const { service, member, key } = await funded(1000);

        const win = await service.settle(guild, member, 100, 250, "casino:test", key());
        expect(win.account.wallet).toBe(1150);
        expect(win.entry).toMatchObject({ kind: "earn", amount: 150, reason: "casino:test:win" });

        const loss = await service.settle(guild, member, 100, 0, "casino:test", key());
        expect(loss.account.wallet).toBe(1050);
        expect(loss.entry).toMatchObject({ kind: "spend", amount: 100, reason: "casino:test:loss" });

        const push = await service.settle(guild, member, 100, 100, "casino:test", key());
        expect(push.entry).toBeNull();
        expect(push.account.wallet).toBe(1050);
        expect(await service.history(guild, member)).toHaveLength(3);
      });

      test("settle : la mise doit être en portefeuille (même à égalité), rien n'est écrit sinon", async () => {
        const { service, member, key } = await funded(50);

        expect((await rejection(service.settle(guild, member, 51, 200, "casino:test", key()))).code).toBe("insufficient_funds");
        expect((await rejection(service.settle(guild, member, 51, 51, "casino:test", key()))).code).toBe("insufficient_funds");
        expect((await rejection(service.settle(guild, member, 0, 0, "casino:test", key()))).code).toBe("invalid_amount");
        expect((await rejection(service.settle(guild, member, 10, -1, "casino:test", key()))).code).toBe("invalid_amount");
        expect((await service.getAccount(guild, member)).wallet).toBe(50);
      });

      test("settle : la même opération rejouée ne s'applique qu'une fois", async () => {
        const { service, member } = await funded(1000);
        const key = `game-${crypto.randomUUID()}`;

        const first = await service.settle(guild, member, 100, 0, "casino:test", key);
        const again = await service.settle(guild, member, 100, 0, "casino:test", key);

        expect(first.replayed).toBe(false);
        expect(again.replayed).toBe(true);
        expect((await service.getAccount(guild, member)).wallet).toBe(900);
      });

      test("credit : verse un gain avec sa raison, une seule fois par clé", async () => {
        const { service, member } = await funded(0);
        const key = `credit-${crypto.randomUUID()}`;

        expect((await service.credit(guild, member, 250, "casino:blackjack:win", key)).entry).toMatchObject({ kind: "earn", amount: 250, reason: "casino:blackjack:win" });
        expect((await service.credit(guild, member, 250, "casino:blackjack:win", key)).replayed).toBe(true);
        expect((await service.getAccount(guild, member)).wallet).toBe(250);
        expect((await rejection(service.credit(guild, member, 0, "x", `k-${crypto.randomUUID()}`))).code).toBe("invalid_amount");
      });
    });
  });
}

describe("PostgreSQL — garde-fous du schéma", () => {
  test("le grand livre est immuable, même en SQL direct", async () => {
    const service = new EconomyService(new PostgresEconomyStore(database), clock, () => 0);
    const member = crypto.randomUUID();
    await service.work("guild", member, `${member}:0`);

    await expect(
      pglite.query("UPDATE economy_ledger SET amount = 999 WHERE member_id = $1", [member]),
    ).rejects.toThrow("immutable");
    await expect(
      pglite.query("DELETE FROM economy_ledger WHERE member_id = $1", [member]),
    ).rejects.toThrow("immutable");
  });

  test("la base refuse un solde négatif et un montant nul", async () => {
    const member = crypto.randomUUID();
    await pglite.query("INSERT INTO economy_account (guild_id, member_id) VALUES ('guild', $1)", [member]);

    await expect(
      pglite.query("UPDATE economy_account SET wallet = -1 WHERE member_id = $1", [member]),
    ).rejects.toThrow();
    await expect(
      pglite.query(
        `INSERT INTO economy_ledger (id, guild_id, member_id, kind, amount, wallet_after, bank_after, reason, idempotency_key, created_at)
         VALUES ($1, 'guild', $2, 'earn', 0, 0, 0, 'x', 'zero', now())`,
        [crypto.randomUUID(), member],
      ),
    ).rejects.toThrow();
  });

  test("RLS est activé sur les tables d'économie", async () => {
    const result = await pglite.query<{ relrowsecurity: boolean }>(
      "SELECT relrowsecurity FROM pg_class WHERE relname IN ('economy_account','economy_ledger')",
    );

    expect(result.rows).toHaveLength(2);
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

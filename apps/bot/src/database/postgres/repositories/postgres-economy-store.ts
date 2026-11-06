import { and, desc, eq, gt, gte, inArray, lt, lte, notInArray, or, sql } from "drizzle-orm";

import type {
  EconomyStore,
  InterestRun,
  Mutation,
  TransactOptions,
  TransactionResult,
  TransferResult,
} from "@/domain/economy/economy-store.ts";
import { ACTIVE_WINDOW_MS } from "@/domain/economy/economy-rules.ts";
import { EconomyError } from "@/domain/economy/economy-error.ts";
import { emptyAccount, type Account, type LedgerEntry, type LedgerKind } from "@/domain/economy/economy-types.ts";
import { creditInterest, type InterestCandidate, type InterestPlan } from "@/domain/economy/interest.ts";
import {
  candleBuckets,
  commitPoolChange,
  rollCasinoDay,
  sharePriceCents,
  utcDay,
  type PoolChange,
  type PoolState,
  type Pools,
} from "@/domain/economy/pools.ts";
import type { WeeklyInput, WeeklyPlan } from "@/domain/economy/weekly.ts";
import type { Database } from "@/database/postgres/connection.ts";
import {
  casinoEntry,
  casinoFund,
  economyAccount,
  economyLedger,
  economyWeekRun,
  guildTreasury,
  interestRun,
  marketCandle,
  treasuryEntry,
} from "@/database/postgres/schema/index.ts";

type AccountRow = typeof economyAccount.$inferSelect;
type LedgerRow = typeof economyLedger.$inferSelect;
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Raisons du grand livre qui ne comptent pas comme une activité du membre (versements automatiques). */
const PASSIVE_REASONS = ["interest", "wealth_tax", "dividend"];

/**
 * Économie en circuit fermé sur PostgreSQL. Ordre de verrouillage, partout le même (comme les fonctions du panneau) :
 * les comptes des membres, puis la réserve (`guild_treasury`), puis le casino (`casino_fund`). Jamais d'interblocage.
 */
export class PostgresEconomyStore implements EconomyStore {
  constructor(private readonly db: Database) {}

  async find(guildId: string, memberId: string): Promise<Account | null> {
    const [row] = await this.db
      .select()
      .from(economyAccount)
      .where(and(eq(economyAccount.guildId, guildId), eq(economyAccount.memberId, memberId)));

    return row ? toAccount(row) : null;
  }

  transact(
    guildId: string,
    memberId: string,
    idempotencyKey: string,
    mutate: (account: Account, pools: Pools) => Mutation,
    options: TransactOptions = {},
  ): Promise<TransactionResult> {
    return this.db.transaction(async (tx) => {
      // Le compte existe, puis on le verrouille : les opérations d'un même membre s'exécutent l'une après l'autre.
      await tx.insert(economyAccount).values({ guildId, memberId }).onConflictDoNothing();

      const [locked] = await tx
        .select()
        .from(economyAccount)
        .where(and(eq(economyAccount.guildId, guildId), eq(economyAccount.memberId, memberId)))
        .for("update");

      if (!locked) {
        throw new Error("economy account vanished during transaction");
      }

      const current = toAccount(locked);
      const [existing] = await tx
        .select()
        .from(economyLedger)
        .where(and(eq(economyLedger.guildId, guildId), eq(economyLedger.idempotencyKey, idempotencyKey)));

      if (existing) {
        return { account: current, entry: toEntry(existing), replayed: true };
      }

      const state = await lockPools(tx, guildId, options.at ?? new Date(), options.salaryDay);
      const { account, entry, pools } = mutate(current, state);
      const next = commit(state, pools);

      await writeAccount(tx, account, entry.createdAt);
      await tx.insert(economyLedger).values(entry);
      await writePools(tx, guildId, state, next, pools, memberId, entry.createdAt);

      return { account, entry, replayed: false };
    });
  }

  transfer(
    guildId: string,
    fromId: string,
    toId: string,
    fromKey: string,
    toKey: string,
    mutateFrom: (account: Account, pools: Pools) => Mutation,
    mutateTo: (account: Account, pools: Pools) => Mutation,
  ): Promise<TransferResult> {
    return this.db.transaction(async (tx) => {
      await tx.insert(economyAccount).values([{ guildId, memberId: fromId }, { guildId, memberId: toId }]).onConflictDoNothing();

      // Toujours dans l'ordre des identifiants : deux virements croisés ne s'attendent jamais l'un l'autre.
      const locked = await tx
        .select()
        .from(economyAccount)
        .where(and(eq(economyAccount.guildId, guildId), inArray(economyAccount.memberId, [fromId, toId])))
        .orderBy(economyAccount.memberId)
        .for("update");
      const fromRow = locked.find((row) => row.memberId === fromId);
      const toRow = locked.find((row) => row.memberId === toId);

      if (!fromRow || !toRow) {
        throw new Error("economy account vanished during transfer");
      }

      const fromCurrent = toAccount(fromRow);
      const toCurrent = toAccount(toRow);
      const [existing] = await tx
        .select()
        .from(economyLedger)
        .where(and(eq(economyLedger.guildId, guildId), eq(economyLedger.idempotencyKey, fromKey)));

      if (existing) {
        const [received] = await tx
          .select()
          .from(economyLedger)
          .where(and(eq(economyLedger.guildId, guildId), eq(economyLedger.idempotencyKey, toKey)));

        return {
          from: { account: fromCurrent, entry: toEntry(existing), replayed: true },
          to: { account: toCurrent, entry: received ? toEntry(received) : toEntry(existing), replayed: true },
        };
      }

      const state = await lockPools(tx, guildId, new Date());
      const out = mutateFrom(fromCurrent, state);
      const into = mutateTo(toCurrent, state);
      const change: PoolChange = { moves: [...(out.pools?.moves ?? []), ...(into.pools?.moves ?? [])] };
      const next = commit(state, change);

      for (const { account, entry } of [out, into]) {
        await writeAccount(tx, account, entry.createdAt);
        await tx.insert(economyLedger).values(entry);
      }

      await writePools(tx, guildId, state, next, change, fromId, out.entry.createdAt);

      return {
        from: { account: out.account, entry: out.entry, replayed: false },
        to: { account: into.account, entry: into.entry, replayed: false },
      };
    });
  }

  accrueInterest(
    guildId: string,
    day: string,
    since: Date,
    now: Date,
    plan: (candidates: readonly InterestCandidate[], reserve: number) => InterestPlan,
  ): Promise<InterestRun | null> {
    return this.db.transaction(async (tx) => {
      // La clé (serveur, jour) est prise en premier : un second passage le même jour s'arrête ici.
      const claimed = await tx.insert(interestRun).values({ guildId, day, createdAt: now }).onConflictDoNothing().returning({ day: interestRun.day });

      if (claimed.length === 0) {
        return null;
      }

      const accounts = await tx
        .select()
        .from(economyAccount)
        .where(and(eq(economyAccount.guildId, guildId), gt(economyAccount.bank, 0)))
        .orderBy(economyAccount.memberId)
        .for("update");
      const memberIds = accounts.map((row) => row.memberId);
      // Banque de chacun à `since` : celle de sa dernière écriture avant cet instant (rien avant = 0).
      const before =
        memberIds.length === 0
          ? []
          : await tx
              .selectDistinctOn([economyLedger.memberId], { memberId: economyLedger.memberId, bank: economyLedger.bankAfter })
              .from(economyLedger)
              .where(and(eq(economyLedger.guildId, guildId), inArray(economyLedger.memberId, memberIds), lte(economyLedger.createdAt, since)))
              .orderBy(economyLedger.memberId, desc(economyLedger.seq));
      const bankBefore = new Map(before.map((row) => [row.memberId, row.bank]));
      const reserve = await lockReserve(tx, guildId);
      const result = plan(
        accounts.map((row) => ({ memberId: row.memberId, bank: row.bank, bankBefore: bankBefore.get(row.memberId) ?? 0 })),
        reserve.balance,
      );
      const byMember = new Map(accounts.map((row) => [row.memberId, toAccount(row)]));
      let paid = 0;

      for (const payout of result.payouts) {
        const credited = creditInterest(byMember.get(payout.memberId)!, payout.amount, day, now);

        if (!credited || paid + payout.amount > reserve.balance) {
          continue;
        }

        await tx
          .update(economyAccount)
          .set({ wallet: credited.account.wallet, updatedAt: now })
          .where(and(eq(economyAccount.guildId, guildId), eq(economyAccount.memberId, payout.memberId)));
        await tx.insert(economyLedger).values(credited.entry);
        paid += payout.amount;
      }

      if (paid > 0) {
        await tx.update(guildTreasury).set({ balance: reserve.balance - paid, updatedAt: now }).where(eq(guildTreasury.guildId, guildId));
        await tx.insert(treasuryEntry).values({
          id: crypto.randomUUID(),
          guildId,
          amount: -paid,
          reason: "interest",
          note: `${result.payouts.length} members`,
          createdAt: now,
        });
      }

      await tx
        .update(interestRun)
        .set({ members: result.payouts.length, wanted: result.wanted, paid })
        .where(and(eq(interestRun.guildId, guildId), eq(interestRun.day, day)));

      return { members: result.payouts.length, wanted: result.wanted, paid };
    });
  }

  weekly(guildId: string, week: string, now: Date, plan: (input: WeeklyInput) => WeeklyPlan): Promise<WeeklyPlan | null> {
    return this.db.transaction(async (tx) => {
      const claimed = await tx.insert(economyWeekRun).values({ guildId, week, createdAt: now }).onConflictDoNothing().returning({ week: economyWeekRun.week });

      if (claimed.length === 0) {
        return null;
      }

      const accounts = await tx
        .select()
        .from(economyAccount)
        .where(and(eq(economyAccount.guildId, guildId), or(gt(economyAccount.wallet, 0), gt(economyAccount.bank, 0), gt(economyAccount.casinoShares, 0))))
        .orderBy(economyAccount.memberId)
        .for("update");
      const lastActive =
        accounts.length === 0
          ? []
          : await tx
              .select({ memberId: economyLedger.memberId, at: sql<Date | string>`max(${economyLedger.createdAt})` })
              .from(economyLedger)
              .where(
                and(
                  eq(economyLedger.guildId, guildId),
                  inArray(economyLedger.memberId, accounts.map((row) => row.memberId)),
                  notInArray(economyLedger.reason, PASSIVE_REASONS),
                ),
              )
              .groupBy(economyLedger.memberId);
      const activeAt = new Map(lastActive.map((row) => [row.memberId, new Date(row.at)]));
      const state = await lockPools(tx, guildId, now);
      const result = plan({
        accounts: accounts.map((row) => ({
          memberId: row.memberId,
          wallet: row.wallet,
          bank: row.bank,
          shares: row.casinoShares,
          lastActiveAt: activeAt.get(row.memberId) ?? null,
        })),
        casinoWeekNet: state.casinoWeekNet,
        carriedLoss: state.carriedLoss,
        casino: state.casino,
        shares: state.shares,
        float: state.float,
      });
      const byMember = new Map(accounts.map((row) => [row.memberId, toAccount(row)]));

      for (const tax of result.taxes) {
        const account = byMember.get(tax.memberId)!;
        const next = { ...account, wallet: account.wallet - tax.fromWallet, bank: account.bank - tax.fromBank };
        byMember.set(tax.memberId, next);
        await writeAccount(tx, next, now);
        await tx.insert(economyLedger).values(weeklyEntry(next, "spend", tax.fromWallet + tax.fromBank, "wealth_tax", `wealth:${week}:${tax.memberId}`, now));
      }

      for (const dividend of result.dividends) {
        const account = byMember.get(dividend.memberId)!;
        const next = { ...account, wallet: account.wallet + dividend.amount };
        byMember.set(dividend.memberId, next);
        await writeAccount(tx, next, now);
        await tx.insert(economyLedger).values(weeklyEntry(next, "earn", dividend.amount, "dividend", `dividend:${week}:${dividend.memberId}`, now));
      }

      const next: PoolState = {
        ...state,
        reserve: state.reserve + result.wealthTax + result.serverDividend + result.casinoTax,
        casino: state.casino - result.dividendsTotal - result.casinoTax,
        casinoWeekNet: 0,
        carriedLoss: result.carriedLoss,
      };

      if (next.casino < 0) {
        throw new EconomyError("casino_limit");
      }

      await writePools(
        tx,
        guildId,
        state,
        next,
        {
          moves: [
            { pool: "reserve", amount: result.wealthTax, reason: "wealth_tax" },
            { pool: "reserve", amount: result.serverDividend, reason: "dividend" },
            { pool: "reserve", amount: result.casinoTax, reason: "casino_tax" },
            { pool: "casino", amount: -result.dividendsTotal, reason: "dividend" },
            { pool: "casino", amount: -result.casinoTax, reason: "tax" },
          ],
        },
        null,
        now,
      );
      await tx
        .update(economyWeekRun)
        .set({
          membersTaxed: result.taxes.length,
          threshold: result.threshold,
          wealthTax: result.wealthTax,
          profit: result.profit,
          dividends: result.dividendsTotal,
          casinoTax: result.casinoTax,
          carriedLoss: result.carriedLoss,
        })
        .where(and(eq(economyWeekRun.guildId, guildId), eq(economyWeekRun.week, week)));

      return result;
    });
  }

  mintArrival(guildId: string, memberId: string, amount: number, at: Date): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      // La réserve est verrouillée d'abord : deux arrivées du même membre ne passent jamais ensemble.
      const reserve = await lockReserve(tx, guildId);
      const [already] = await tx
        .select({ id: treasuryEntry.id })
        .from(treasuryEntry)
        .where(and(eq(treasuryEntry.guildId, guildId), eq(treasuryEntry.memberId, memberId), eq(treasuryEntry.reason, "arrival")))
        .limit(1);

      if (already || amount <= 0) {
        return false;
      }

      await tx.update(guildTreasury).set({ balance: reserve.balance + amount, updatedAt: at }).where(eq(guildTreasury.guildId, guildId));
      await tx.insert(treasuryEntry).values({ id: crypto.randomUUID(), guildId, amount, reason: "arrival", memberId, createdAt: at });

      return true;
    });
  }

  forget(guildId: string, memberId: string, at: Date): Promise<Readonly<{ returned: number; shares: number }>> {
    return this.db.transaction(async (tx) => {
      // Autorise, pour ce seul membre et cette seule transaction, l'effacement de son grand livre (voir 0018).
      await tx.execute(sql`SELECT set_config('sakutina.forget', ${`${guildId}:${memberId}`}, true)`);

      const [row] = await tx
        .select()
        .from(economyAccount)
        .where(and(eq(economyAccount.guildId, guildId), eq(economyAccount.memberId, memberId)))
        .for("update");
      const returned = row ? row.wallet + row.bank : 0;
      const shares = row?.casinoShares ?? 0;

      if (row) {
        const state = await lockPools(tx, guildId, at);
        const next: PoolState = { ...state, reserve: state.reserve + returned, float: state.float + shares };
        await writePools(tx, guildId, state, next, { moves: [{ pool: "reserve", amount: returned, reason: "forget" }] }, null, at);
      }

      await tx.delete(economyLedger).where(and(eq(economyLedger.guildId, guildId), eq(economyLedger.memberId, memberId)));
      await tx.delete(economyAccount).where(and(eq(economyAccount.guildId, guildId), eq(economyAccount.memberId, memberId)));
      await tx.update(treasuryEntry).set({ memberId: null }).where(and(eq(treasuryEntry.guildId, guildId), eq(treasuryEntry.memberId, memberId)));
      await tx.update(casinoEntry).set({ memberId: null }).where(and(eq(casinoEntry.guildId, guildId), eq(casinoEntry.memberId, memberId)));

      return { returned, shares };
    });
  }

  pools(guildId: string, at: Date = new Date()): Promise<Pools> {
    return this.db.transaction((tx) => readPools(tx, guildId, at, false));
  }

  async priceBefore(guildId: string, at: Date): Promise<number | null> {
    const [row] = await this.db
      .select({ close: marketCandle.close })
      .from(marketCandle)
      .where(
        and(
          eq(marketCandle.guildId, guildId),
          eq(marketCandle.period, "15m"),
          lte(marketCandle.bucket, new Date(at.getTime() - 900_000)),
        ),
      )
      .orderBy(desc(marketCandle.bucket))
      .limit(1);

    return row?.close ?? null;
  }

  async purgeCandles(before: Date): Promise<number> {
    const removed = await this.db
      .delete(marketCandle)
      .where(and(eq(marketCandle.period, "15m"), lt(marketCandle.bucket, before)))
      .returning({ bucket: marketCandle.bucket });

    return removed.length;
  }

  async leaderboard(guildId: string, limit: number): Promise<readonly Account[]> {
    const total = sql`${economyAccount.wallet} + ${economyAccount.bank}`;
    const rows = await this.db
      .select()
      .from(economyAccount)
      .where(and(eq(economyAccount.guildId, guildId), gt(total, sql`0`)))
      .orderBy(desc(total), economyAccount.memberId)
      .limit(limit);

    return rows.map(toAccount);
  }

  async history(guildId: string, memberId: string, limit: number, offset = 0): Promise<readonly LedgerEntry[]> {
    const rows = await this.db
      .select()
      .from(economyLedger)
      .where(and(eq(economyLedger.guildId, guildId), eq(economyLedger.memberId, memberId)))
      .orderBy(desc(economyLedger.seq))
      .limit(limit)
      .offset(offset);

    return rows.map(toEntry);
  }
}

/** La réserve du serveur, créée si besoin (le déclencheur lui donne sa dotation et ouvre le casino), verrouillée. */
async function lockReserve(tx: Tx, guildId: string) {
  await tx.insert(guildTreasury).values({ guildId }).onConflictDoNothing();
  const [row] = await tx.select().from(guildTreasury).where(eq(guildTreasury.guildId, guildId)).for("update");

  if (!row) {
    throw new Error("guild treasury vanished during transaction");
  }

  return row;
}

/** Les caisses du serveur, verrouillées (réserve puis casino). */
function lockPools(tx: Tx, guildId: string, at: Date, salaryDay?: string): Promise<PoolState> {
  return readPools(tx, guildId, at, true, salaryDay);
}

async function readPools(tx: Tx, guildId: string, at: Date, lock: boolean, salaryDay?: string): Promise<PoolState> {
  await tx.insert(guildTreasury).values({ guildId }).onConflictDoNothing();
  const reserveQuery = tx.select().from(guildTreasury).where(eq(guildTreasury.guildId, guildId));
  const [reserve] = lock ? await reserveQuery.for("update") : await reserveQuery;
  const fundQuery = tx.select().from(casinoFund).where(eq(casinoFund.guildId, guildId));
  const [fund] = lock ? await fundQuery.for("update") : await fundQuery;

  if (!reserve || !fund) {
    throw new Error("guild pools missing");
  }

  let salary = {
    day: reserve.salaryDay ?? "",
    budget: reserve.salaryBudget,
    paid: reserve.salaryPaid,
    active: reserve.salaryActive,
  };

  if (salaryDay && salary.day !== salaryDay) {
    const since = new Date(Date.parse(`${salaryDay}T00:00:00.000Z`) - ACTIVE_WINDOW_MS);
    const [count] = await tx
      .select({ active: sql<number>`count(distinct ${economyLedger.memberId})::int` })
      .from(economyLedger)
      .where(and(eq(economyLedger.guildId, guildId), inArray(economyLedger.reason, ["work", "daily"]), gte(economyLedger.createdAt, since)));
    salary = { day: salaryDay, budget: null, paid: 0, active: Math.max(Number(count?.active ?? 0), 1) };
  }

  return rollCasinoDay(
    {
      reserve: reserve.balance,
      casino: fund.balance,
      jackpot: fund.jackpot,
      shares: fund.shares,
      float: fund.serverShares,
      salary,
      casinoDay: fund.day ?? "",
      casinoDayStart: fund.dayStart,
      casinoDayNet: fund.dayNet,
      casinoWeekNet: fund.weekNet,
      carriedLoss: fund.carriedLoss,
    },
    utcDay(at),
  );
}

function commit(state: PoolState, change: PoolChange | undefined): PoolState {
  if (!change) {
    return state;
  }

  const next = commitPoolChange(state, change);

  if (!next) {
    throw new EconomyError(change.floatDelta ? "shares_unavailable" : "casino_limit");
  }

  return next;
}

/** Écrit les caisses, leurs journaux (un par déplacement non nul) et, si le cours a bougé, ses bougies. */
async function writePools(
  tx: Tx,
  guildId: string,
  before: PoolState,
  after: PoolState,
  change: PoolChange | undefined,
  memberId: string | null,
  at: Date,
): Promise<void> {
  await tx
    .update(guildTreasury)
    .set({
      balance: after.reserve,
      salaryDay: after.salary.day === "" ? null : after.salary.day,
      salaryBudget: after.salary.budget,
      salaryPaid: after.salary.paid,
      salaryActive: after.salary.active,
      updatedAt: at,
    })
    .where(eq(guildTreasury.guildId, guildId));
  await tx
    .update(casinoFund)
    .set({
      balance: after.casino,
      jackpot: after.jackpot,
      serverShares: after.float,
      day: after.casinoDay === "" ? null : after.casinoDay,
      dayStart: after.casinoDayStart,
      dayNet: after.casinoDayNet,
      weekNet: after.casinoWeekNet,
      carriedLoss: after.carriedLoss,
      updatedAt: at,
    })
    .where(eq(casinoFund.guildId, guildId));

  for (const move of change?.moves ?? []) {
    if (move.amount === 0) {
      continue;
    }

    if (move.pool === "reserve") {
      await tx.insert(treasuryEntry).values({ id: crypto.randomUUID(), guildId, amount: move.amount, reason: move.reason, memberId, createdAt: at });
    } else {
      await tx.insert(casinoEntry).values({ id: crypto.randomUUID(), guildId, pool: move.pool, amount: move.amount, reason: move.reason, memberId, createdAt: at });
    }
  }

  const volume = change?.volume ?? 0;

  if (after.casino !== before.casino || volume > 0) {
    await recordPrice(tx, guildId, sharePriceCents(after.casino, after.shares), volume, at);
  }
}

/** Met à jour les bougies de 15 min et du jour : la première d'une période s'ouvre au cours de clôture précédent. */
async function recordPrice(tx: Tx, guildId: string, price: number, volume: number, at: Date): Promise<void> {
  const { quarter, day } = candleBuckets(at);

  for (const [period, bucket] of [["15m", quarter], ["1d", day]] as const) {
    const [last] = await tx
      .select()
      .from(marketCandle)
      .where(and(eq(marketCandle.guildId, guildId), eq(marketCandle.period, period), lte(marketCandle.bucket, bucket)))
      .orderBy(desc(marketCandle.bucket))
      .limit(1);

    if (last && last.bucket.getTime() === bucket.getTime()) {
      await tx
        .update(marketCandle)
        .set({ high: Math.max(last.high, price), low: Math.min(last.low, price), close: price, volume: last.volume + volume })
        .where(and(eq(marketCandle.guildId, guildId), eq(marketCandle.period, period), eq(marketCandle.bucket, bucket)));
    } else {
      const open = last?.close ?? price;
      await tx
        .insert(marketCandle)
        .values({ guildId, period, bucket, open, high: Math.max(open, price), low: Math.min(open, price), close: price, volume });
    }
  }
}

async function writeAccount(tx: Tx, account: Account, at: Date): Promise<void> {
  await tx
    .update(economyAccount)
    .set({
      wallet: account.wallet,
      bank: account.bank,
      lastWorkAt: account.lastWorkAt,
      lastDailyAt: account.lastDailyAt,
      dailyStreak: account.dailyStreak,
      casinoShares: account.shares,
      updatedAt: at,
    })
    .where(and(eq(economyAccount.guildId, account.guildId), eq(economyAccount.memberId, account.memberId)));
}

function weeklyEntry(account: Account, kind: "earn" | "spend", amount: number, reason: string, key: string, now: Date): LedgerEntry {
  return {
    id: crypto.randomUUID(),
    guildId: account.guildId,
    memberId: account.memberId,
    kind,
    amount,
    walletAfter: account.wallet,
    bankAfter: account.bank,
    reason,
    idempotencyKey: key,
    createdAt: now,
  };
}

function toAccount(row: AccountRow): Account {
  return {
    ...emptyAccount(row.guildId, row.memberId),
    wallet: row.wallet,
    bank: row.bank,
    lastWorkAt: row.lastWorkAt,
    lastDailyAt: row.lastDailyAt,
    dailyStreak: row.dailyStreak,
    shares: row.casinoShares,
  };
}

function toEntry(row: LedgerRow): LedgerEntry {
  const { seq: _seq, ...entry } = row;

  return { ...entry, kind: entry.kind as LedgerKind };
}

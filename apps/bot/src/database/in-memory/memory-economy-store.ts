import type { EconomyStore, InterestRun, Mutation, TransactOptions, TransactionResult, TransferResult } from "@/domain/economy/economy-store.ts";
import { ACTIVE_WINDOW_MS, CASINO_SEED, CASINO_SHARES, GENESIS_RESERVE } from "@/domain/economy/economy-rules.ts";
import { EconomyError } from "@/domain/economy/economy-error.ts";
import { emptyAccount, type Account, type LedgerEntry } from "@/domain/economy/economy-types.ts";
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

/** Raisons du grand livre qui ne comptent pas comme une activité du membre (versements automatiques). */
export const PASSIVE_REASONS: readonly string[] = ["interest", "wealth_tax", "dividend"];

type Candle = { guildId: string; period: "15m" | "1d"; bucket: number; open: number; high: number; low: number; close: number; volume: number };

/** Stockage de développement et de test : perdu au redémarrage. Mêmes règles que la base. */
export class MemoryEconomyStore implements EconomyStore {
  private readonly accounts = new Map<string, Account>();
  private readonly ledger: LedgerEntry[] = [];
  private readonly states = new Map<string, PoolState>();
  /** Dotations de la réserve (lancement et arrivées) : la masse monétaire de chaque serveur. */
  private readonly endowments: Array<{ guildId: string; memberId: string | null; amount: number }> = [];
  private readonly interestDays = new Set<string>();
  private readonly weeks = new Set<string>();
  private readonly candles: Candle[] = [];
  private queue: Promise<unknown> = Promise.resolve();

  async find(guildId: string, memberId: string): Promise<Account | null> {
    return this.accounts.get(keyOf(guildId, memberId)) ?? null;
  }

  transact(
    guildId: string,
    memberId: string,
    idempotencyKey: string,
    mutate: (account: Account, pools: Pools) => Mutation,
    options: TransactOptions = {},
  ): Promise<TransactionResult> {
    return this.serial(() => {
      const current = this.accounts.get(keyOf(guildId, memberId)) ?? emptyAccount(guildId, memberId);
      const existing = this.findEntry(guildId, idempotencyKey);

      if (existing) {
        return { account: current, entry: existing, replayed: true };
      }

      const state = this.stateFor(guildId, options.salaryDay, options.at);
      const { account, entry, pools } = mutate(current, state);
      const next = this.commit(state, pools);

      this.accounts.set(keyOf(guildId, memberId), account);
      this.ledger.push(entry);
      this.save(guildId, state, next, pools, entry.createdAt);

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
    return this.serial(() => {
      const fromAccount = this.accounts.get(keyOf(guildId, fromId)) ?? emptyAccount(guildId, fromId);
      const toAccount = this.accounts.get(keyOf(guildId, toId)) ?? emptyAccount(guildId, toId);
      const existing = this.findEntry(guildId, fromKey);

      if (existing) {
        const received = this.findEntry(guildId, toKey);

        return {
          from: { account: fromAccount, entry: existing, replayed: true },
          to: { account: toAccount, entry: received ?? existing, replayed: true },
        };
      }

      // Les deux changements sont calculés avant la moindre écriture : si l'un lève, rien n'est écrit.
      const state = this.stateFor(guildId);
      const out = mutateFrom(fromAccount, state);
      const into = mutateTo(toAccount, state);
      const change: PoolChange = { moves: [...(out.pools?.moves ?? []), ...(into.pools?.moves ?? [])] };
      const next = this.commit(state, change);

      this.accounts.set(keyOf(guildId, fromId), out.account);
      this.accounts.set(keyOf(guildId, toId), into.account);
      this.ledger.push(out.entry, into.entry);
      this.save(guildId, state, next, change, out.entry.createdAt);

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
    return this.serial(() => {
      if (this.interestDays.has(`${guildId}:${day}`)) {
        return null;
      }

      const candidates: InterestCandidate[] = this.accountsOf(guildId)
        .filter((account) => account.bank > 0)
        .map((account) => {
          const before = this.ledger.findLast((entry) => entry.guildId === guildId && entry.memberId === account.memberId && entry.createdAt <= since);

          return { memberId: account.memberId, bank: account.bank, bankBefore: before?.bankAfter ?? 0 };
        });
      const state = this.stateFor(guildId);
      const result = plan(candidates, state.reserve);
      let paid = 0;

      for (const payout of result.payouts) {
        const credited = creditInterest(this.accounts.get(keyOf(guildId, payout.memberId)) ?? emptyAccount(guildId, payout.memberId), payout.amount, day, now);

        if (credited && paid + payout.amount <= state.reserve) {
          this.accounts.set(keyOf(guildId, payout.memberId), credited.account);
          this.ledger.push(credited.entry);
          paid += payout.amount;
        }
      }

      this.states.set(guildId, { ...state, reserve: state.reserve - paid });
      this.interestDays.add(`${guildId}:${day}`);

      return { members: result.payouts.length, wanted: result.wanted, paid };
    });
  }

  weekly(guildId: string, week: string, now: Date, plan: (input: WeeklyInput) => WeeklyPlan): Promise<WeeklyPlan | null> {
    return this.serial(() => {
      if (this.weeks.has(`${guildId}:${week}`)) {
        return null;
      }

      const state = rollCasinoDay(this.stateFor(guildId), utcDay(now));
      const accounts = this.accountsOf(guildId);
      const result = plan({
        accounts: accounts.map((account) => ({
          memberId: account.memberId,
          wallet: account.wallet,
          bank: account.bank,
          shares: account.shares,
          lastActiveAt:
            this.ledger.findLast((entry) => entry.guildId === guildId && entry.memberId === account.memberId && !PASSIVE_REASONS.includes(entry.reason))
              ?.createdAt ?? null,
        })),
        casinoWeekNet: state.casinoWeekNet,
        carriedLoss: state.carriedLoss,
        casino: state.casino,
        shares: state.shares,
        float: state.float,
      });
      let reserve = state.reserve + result.serverDividend + result.casinoTax;

      for (const tax of result.taxes) {
        const account = this.accounts.get(keyOf(guildId, tax.memberId))!;
        const next = { ...account, wallet: account.wallet - tax.fromWallet, bank: account.bank - tax.fromBank };
        this.accounts.set(keyOf(guildId, tax.memberId), next);
        this.ledger.push(weeklyEntry(next, "spend", tax.fromWallet + tax.fromBank, "wealth_tax", `wealth:${week}:${tax.memberId}`, now));
        reserve += tax.fromWallet + tax.fromBank;
      }

      for (const dividend of result.dividends) {
        const account = this.accounts.get(keyOf(guildId, dividend.memberId))!;
        const next = { ...account, wallet: account.wallet + dividend.amount };
        this.accounts.set(keyOf(guildId, dividend.memberId), next);
        this.ledger.push(weeklyEntry(next, "earn", dividend.amount, "dividend", `dividend:${week}:${dividend.memberId}`, now));
      }

      const casino = state.casino - result.dividendsTotal - result.casinoTax;
      this.states.set(guildId, { ...state, reserve, casino, casinoWeekNet: 0, carriedLoss: result.carriedLoss });
      this.recordPrice(guildId, casino, state.shares, 0, now);
      this.weeks.add(`${guildId}:${week}`);

      return result;
    });
  }

  mintArrival(guildId: string, memberId: string, amount: number, _at: Date): Promise<boolean> {
    return this.serial(() => {
      if (this.endowments.some((entry) => entry.guildId === guildId && entry.memberId === memberId)) {
        return false;
      }

      const state = this.stateFor(guildId);
      this.states.set(guildId, { ...state, reserve: state.reserve + amount });
      this.endowments.push({ guildId, memberId, amount });

      return true;
    });
  }

  forget(guildId: string, memberId: string, _at: Date): Promise<Readonly<{ returned: number; shares: number }>> {
    return this.serial(() => {
      const account = this.accounts.get(keyOf(guildId, memberId));

      if (!account) {
        return { returned: 0, shares: 0 };
      }

      const state = this.stateFor(guildId);
      const returned = account.wallet + account.bank;
      this.states.set(guildId, { ...state, reserve: state.reserve + returned, float: state.float + account.shares });
      this.accounts.delete(keyOf(guildId, memberId));

      for (let index = this.ledger.length - 1; index >= 0; index -= 1) {
        if (this.ledger[index]!.guildId === guildId && this.ledger[index]!.memberId === memberId) {
          this.ledger.splice(index, 1);
        }
      }

      for (const entry of this.endowments) {
        if (entry.guildId === guildId && entry.memberId === memberId) {
          entry.memberId = null;
        }
      }

      return { returned, shares: account.shares };
    });
  }

  async pools(guildId: string, at: Date = new Date()): Promise<Pools> {
    return this.stateFor(guildId, undefined, at);
  }

  async priceBefore(guildId: string, at: Date): Promise<number | null> {
    const candle = this.candles.findLast((entry) => entry.guildId === guildId && entry.period === "15m" && entry.bucket + 900_000 <= at.getTime());

    return candle?.close ?? null;
  }

  async purgeCandles(before: Date): Promise<number> {
    const kept = this.candles.filter((entry) => entry.period !== "15m" || entry.bucket >= before.getTime());
    const removed = this.candles.length - kept.length;
    this.candles.splice(0, this.candles.length, ...kept);

    return removed;
  }

  /** Masse monétaire d'un serveur : la somme des dotations (pour vérifier que rien n'est créé ni détruit). */
  moneySupply(guildId: string): number {
    this.stateFor(guildId);

    return this.endowments.filter((entry) => entry.guildId === guildId).reduce((sum, entry) => sum + entry.amount, 0);
  }

  /** Argent effectivement présent : comptes des membres et caisses du serveur. */
  moneyHeld(guildId: string): number {
    const state = this.stateFor(guildId);

    return this.accountsOf(guildId).reduce((sum, account) => sum + account.wallet + account.bank, 0) + state.reserve + state.casino + state.jackpot;
  }

  async leaderboard(guildId: string, limit: number): Promise<readonly Account[]> {
    return this.accountsOf(guildId)
      .filter((account) => account.wallet + account.bank > 0)
      .sort((a, b) => b.wallet + b.bank - (a.wallet + a.bank) || a.memberId.localeCompare(b.memberId))
      .slice(0, limit);
  }

  async history(guildId: string, memberId: string, limit: number, offset = 0): Promise<readonly LedgerEntry[]> {
    return this.ledger
      .filter((entry) => entry.guildId === guildId && entry.memberId === memberId)
      .reverse()
      .slice(offset, offset + limit);
  }

  private serial<T>(work: () => T): Promise<T> {
    // File unique : les opérations s'exécutent l'une après l'autre.
    const run = this.queue.then(work);
    this.queue = run.catch(() => undefined);

    return run;
  }

  private findEntry(guildId: string, idempotencyKey: string): LedgerEntry | undefined {
    return this.ledger.find((entry) => entry.guildId === guildId && entry.idempotencyKey === idempotencyKey);
  }

  private accountsOf(guildId: string): Account[] {
    return [...this.accounts.values()].filter((account) => account.guildId === guildId);
  }

  /** Les caisses du serveur, créées à la première utilisation avec la dotation de lancement et l'apport du casino. */
  private stateFor(guildId: string, salaryDay?: string, at: Date = new Date()): PoolState {
    let state = this.states.get(guildId);

    if (!state) {
      const seed = Math.min(CASINO_SEED, GENESIS_RESERVE);
      state = {
        reserve: GENESIS_RESERVE - seed,
        casino: seed,
        jackpot: 0,
        shares: CASINO_SHARES,
        float: CASINO_SHARES,
        salary: { day: "", budget: null, paid: 0, active: 1 },
        casinoDay: "",
        casinoDayStart: seed,
        casinoDayNet: 0,
        casinoWeekNet: 0,
        carriedLoss: 0,
      };
      this.endowments.push({ guildId, memberId: null, amount: GENESIS_RESERVE });
      this.states.set(guildId, state);
    }

    state = rollCasinoDay(state, utcDay(at));
    this.states.set(guildId, state);

    if (salaryDay && state.salary.day !== salaryDay) {
      const since = Date.parse(`${salaryDay}T00:00:00.000Z`) - ACTIVE_WINDOW_MS;
      const active = new Set(
        this.ledger
          .filter((entry) => entry.guildId === guildId && (entry.reason === "work" || entry.reason === "daily") && entry.createdAt.getTime() >= since)
          .map((entry) => entry.memberId),
      ).size;
      state = { ...state, salary: { day: salaryDay, budget: null, paid: 0, active: Math.max(active, 1) } };
    }

    return state;
  }

  private commit(state: PoolState, change: PoolChange | undefined): PoolState {
    if (!change) {
      return state;
    }

    const next = commitPoolChange(state, change);

    if (!next) {
      throw new EconomyError(change.floatDelta ? "shares_unavailable" : "casino_limit");
    }

    return next;
  }

  private save(guildId: string, before: PoolState, after: PoolState, change: PoolChange | undefined, at: Date): void {
    this.states.set(guildId, after);

    if (after.casino !== before.casino || (change?.volume ?? 0) > 0) {
      this.recordPrice(guildId, after.casino, after.shares, change?.volume ?? 0, at);
    }
  }

  private recordPrice(guildId: string, casino: number, shares: number, volume: number, at: Date): void {
    const price = sharePriceCents(casino, shares);
    const { quarter, day } = candleBuckets(at);

    for (const [period, bucket] of [["15m", quarter.getTime()], ["1d", day.getTime()]] as const) {
      const candle = this.candles.find((entry) => entry.guildId === guildId && entry.period === period && entry.bucket === bucket);

      if (candle) {
        candle.high = Math.max(candle.high, price);
        candle.low = Math.min(candle.low, price);
        candle.close = price;
        candle.volume += volume;
      } else {
        const open = this.candles.findLast((entry) => entry.guildId === guildId && entry.period === period)?.close ?? price;
        this.candles.push({ guildId, period, bucket, open, high: Math.max(open, price), low: Math.min(open, price), close: price, volume });
      }
    }
  }
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

function keyOf(guildId: string, memberId: string): string {
  return `${guildId}:${memberId}`;
}

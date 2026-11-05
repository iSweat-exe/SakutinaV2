import type { EconomyStore, Mutation, TransactionResult, TransferResult, TreasuryMove } from "@/domain/economy/economy-store.ts";
import { emptyAccount, type Account, type LedgerEntry } from "@/domain/economy/economy-types.ts";

/** Stockage de développement et de test : perdu au redémarrage. */
export class MemoryEconomyStore implements EconomyStore {
  private readonly accounts = new Map<string, Account>();
  private readonly ledger: LedgerEntry[] = [];
  private readonly treasuries = new Map<string, number>();
  private queue: Promise<unknown> = Promise.resolve();

  async find(guildId: string, memberId: string): Promise<Account | null> {
    return this.accounts.get(keyOf(guildId, memberId)) ?? null;
  }

  transact(
    guildId: string,
    memberId: string,
    idempotencyKey: string,
    mutate: (account: Account) => Mutation,
  ): Promise<TransactionResult> {
    // File unique : les opérations s'exécutent l'une après l'autre.
    const run = this.queue.then(() =>
      this.apply(guildId, memberId, idempotencyKey, mutate),
    );
    this.queue = run.catch(() => undefined);

    return run;
  }

  transfer(
    guildId: string,
    fromId: string,
    toId: string,
    fromKey: string,
    toKey: string,
    mutateFrom: (account: Account) => Mutation,
    mutateTo: (account: Account) => Mutation,
  ): Promise<TransferResult> {
    const run = this.queue.then(() => {
      const fromAccount = this.accounts.get(keyOf(guildId, fromId)) ?? emptyAccount(guildId, fromId);
      const toAccount = this.accounts.get(keyOf(guildId, toId)) ?? emptyAccount(guildId, toId);
      const existing = this.ledger.find((entry) => entry.guildId === guildId && entry.idempotencyKey === fromKey);

      if (existing) {
        const received = this.ledger.find((entry) => entry.guildId === guildId && entry.idempotencyKey === toKey);

        return {
          from: { account: fromAccount, entry: existing, replayed: true },
          to: { account: toAccount, entry: received ?? existing, replayed: true },
        };
      }

      // Les deux changements sont calculés avant la moindre écriture : si l'un lève, rien n'est écrit.
      const out = mutateFrom(fromAccount);
      const into = mutateTo(toAccount);

      this.accounts.set(keyOf(guildId, fromId), out.account);
      this.accounts.set(keyOf(guildId, toId), into.account);
      this.ledger.push(out.entry, into.entry);
      this.moveTreasury(guildId, out.treasury);
      this.moveTreasury(guildId, into.treasury);

      return {
        from: { account: out.account, entry: out.entry, replayed: false },
        to: { account: into.account, entry: into.entry, replayed: false },
      };
    });
    this.queue = run.catch(() => undefined);

    return run;
  }

  async treasury(guildId: string): Promise<number> {
    return this.treasuries.get(guildId) ?? 0;
  }

  async leaderboard(guildId: string, limit: number): Promise<readonly Account[]> {
    return [...this.accounts.values()]
      .filter((account) => account.guildId === guildId && account.wallet + account.bank > 0)
      .sort(
        (a, b) =>
          b.wallet + b.bank - (a.wallet + a.bank) || a.memberId.localeCompare(b.memberId),
      )
      .slice(0, limit);
  }

  async history(
    guildId: string,
    memberId: string,
    limit: number,
    offset = 0,
  ): Promise<readonly LedgerEntry[]> {
    return this.ledger
      .filter((entry) => entry.guildId === guildId && entry.memberId === memberId)
      .reverse()
      .slice(offset, offset + limit);
  }

  private moveTreasury(guildId: string, move: TreasuryMove | undefined): void {
    if (!move) {
      return;
    }

    const balance = this.treasuries.get(guildId) ?? 0;

    this.treasuries.set(guildId, move.kind === "in" ? balance + move.amount : balance - Math.min(move.upTo, balance));
  }

  private apply(
    guildId: string,
    memberId: string,
    idempotencyKey: string,
    mutate: (account: Account) => Mutation,
  ): TransactionResult {
    const key = keyOf(guildId, memberId);
    const current = this.accounts.get(key) ?? emptyAccount(guildId, memberId);
    const existing = this.ledger.find(
      (entry) => entry.guildId === guildId && entry.idempotencyKey === idempotencyKey,
    );

    if (existing) {
      return { account: current, entry: existing, replayed: true };
    }

    const { account, entry, treasury } = mutate(current);
    this.accounts.set(key, account);
    this.ledger.push(entry);
    this.moveTreasury(guildId, treasury);

    return { account, entry, replayed: false };
  }
}

function keyOf(guildId: string, memberId: string): string {
  return `${guildId}:${memberId}`;
}

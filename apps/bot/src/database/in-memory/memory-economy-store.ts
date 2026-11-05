import type { EconomyStore, Mutation, TransactionResult } from "@/domain/economy/economy-store.ts";
import { emptyAccount, type Account, type LedgerEntry } from "@/domain/economy/economy-types.ts";

/** Stockage de développement et de test : perdu au redémarrage. */
export class MemoryEconomyStore implements EconomyStore {
  private readonly accounts = new Map<string, Account>();
  private readonly ledger: LedgerEntry[] = [];
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

    const { account, entry } = mutate(current);
    this.accounts.set(key, account);
    this.ledger.push(entry);

    return { account, entry, replayed: false };
  }
}

function keyOf(guildId: string, memberId: string): string {
  return `${guildId}:${memberId}`;
}

import { and, desc, eq, gt, sql } from "drizzle-orm";

import type {
  EconomyStore,
  Mutation,
  TransactionResult,
} from "@/domain/economy/economy-store.ts";
import { emptyAccount, type Account, type LedgerEntry, type LedgerKind } from "@/domain/economy/economy-types.ts";
import type { Database } from "@/database/postgres/connection.ts";
import { economyAccount, economyLedger } from "@/database/postgres/schema/index.ts";

type AccountRow = typeof economyAccount.$inferSelect;
type LedgerRow = typeof economyLedger.$inferSelect;

export class PostgresEconomyStore implements EconomyStore {
  constructor(private readonly db: Database) {}

  async find(guildId: string, memberId: string): Promise<Account | null> {
    const [row] = await this.db
      .select()
      .from(economyAccount)
      .where(
        and(eq(economyAccount.guildId, guildId), eq(economyAccount.memberId, memberId)),
      );

    return row ? toAccount(row) : null;
  }

  transact(
    guildId: string,
    memberId: string,
    idempotencyKey: string,
    mutate: (account: Account) => Mutation,
  ): Promise<TransactionResult> {
    return this.db.transaction(async (tx) => {
      // Le compte existe, puis on le verrouille : les opérations d'un même
      // membre s'exécutent l'une après l'autre, même avec plusieurs processus.
      await tx
        .insert(economyAccount)
        .values({ guildId, memberId })
        .onConflictDoNothing();

      const [locked] = await tx
        .select()
        .from(economyAccount)
        .where(
          and(eq(economyAccount.guildId, guildId), eq(economyAccount.memberId, memberId)),
        )
        .for("update");

      if (!locked) {
        throw new Error("economy account vanished during transaction");
      }

      const current = toAccount(locked);
      const [existing] = await tx
        .select()
        .from(economyLedger)
        .where(
          and(
            eq(economyLedger.guildId, guildId),
            eq(economyLedger.idempotencyKey, idempotencyKey),
          ),
        );

      if (existing) {
        return { account: current, entry: toEntry(existing), replayed: true };
      }

      const { account, entry } = mutate(current);

      await tx
        .update(economyAccount)
        .set({
          wallet: account.wallet,
          bank: account.bank,
          lastWorkAt: account.lastWorkAt,
          lastDailyAt: account.lastDailyAt,
          dailyStreak: account.dailyStreak,
          updatedAt: entry.createdAt,
        })
        .where(
          and(eq(economyAccount.guildId, guildId), eq(economyAccount.memberId, memberId)),
        );
      await tx.insert(economyLedger).values(entry);

      return { account, entry, replayed: false };
    });
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

  async history(
    guildId: string,
    memberId: string,
    limit: number,
    offset = 0,
  ): Promise<readonly LedgerEntry[]> {
    const rows = await this.db
      .select()
      .from(economyLedger)
      .where(
        and(eq(economyLedger.guildId, guildId), eq(economyLedger.memberId, memberId)),
      )
      .orderBy(desc(economyLedger.seq))
      .limit(limit)
      .offset(offset);

    return rows.map(toEntry);
  }
}

function toAccount(row: AccountRow): Account {
  return {
    ...emptyAccount(row.guildId, row.memberId),
    wallet: row.wallet,
    bank: row.bank,
    lastWorkAt: row.lastWorkAt,
    lastDailyAt: row.lastDailyAt,
    dailyStreak: row.dailyStreak,
  };
}

function toEntry(row: LedgerRow): LedgerEntry {
  const { seq: _seq, ...entry } = row;

  return { ...entry, kind: entry.kind as LedgerKind };
}

import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";

import type {
  EconomyStore,
  Mutation,
  TransactionResult,
  TransferResult,
  TreasuryMove,
} from "@/domain/economy/economy-store.ts";
import { emptyAccount, type Account, type LedgerEntry, type LedgerKind } from "@/domain/economy/economy-types.ts";
import type { Database } from "@/database/postgres/connection.ts";
import { economyAccount, economyLedger, guildTreasury, treasuryEntry } from "@/database/postgres/schema/index.ts";

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

      const { account, entry, treasury } = mutate(current);

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
      await moveTreasury(tx, guildId, entry.memberId, treasury, entry.createdAt);

      return { account, entry, replayed: false };
    });
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

      const out = mutateFrom(fromCurrent);
      const into = mutateTo(toCurrent);

      for (const { account, entry } of [out, into]) {
        await tx
          .update(economyAccount)
          .set({ wallet: account.wallet, bank: account.bank, updatedAt: entry.createdAt })
          .where(and(eq(economyAccount.guildId, guildId), eq(economyAccount.memberId, account.memberId)));
        await tx.insert(economyLedger).values(entry);
      }

      // Le trésor se verrouille après les comptes, toujours dans cet ordre (comme panel_treasury_pay_out).
      await moveTreasury(tx, guildId, out.entry.memberId, out.treasury, out.entry.createdAt);
      await moveTreasury(tx, guildId, into.entry.memberId, into.treasury, into.entry.createdAt);

      return {
        from: { account: out.account, entry: out.entry, replayed: false },
        to: { account: into.account, entry: into.entry, replayed: false },
      };
    });
  }

  async treasury(guildId: string): Promise<number> {
    const [row] = await this.db.select().from(guildTreasury).where(eq(guildTreasury.guildId, guildId));

    return row?.balance ?? 0;
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

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Applique le mouvement du trésor (s'il y en a un) et l'inscrit au journal ; rien si `out` ne trouve plus rien à retirer. */
async function moveTreasury(
  tx: Tx,
  guildId: string,
  memberId: string,
  move: TreasuryMove | undefined,
  at: Date,
): Promise<void> {
  if (!move) {
    return;
  }

  await tx.insert(guildTreasury).values({ guildId }).onConflictDoNothing();

  const [row] = await tx.select().from(guildTreasury).where(eq(guildTreasury.guildId, guildId)).for("update");
  const balance = row?.balance ?? 0;
  const delta = move.kind === "in" ? move.amount : -Math.min(move.upTo, balance);

  if (delta === 0) {
    return;
  }

  await tx.update(guildTreasury).set({ balance: balance + delta, updatedAt: at }).where(eq(guildTreasury.guildId, guildId));
  await tx.insert(treasuryEntry).values({ id: crypto.randomUUID(), guildId, amount: delta, reason: move.reason, memberId, createdAt: at });
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

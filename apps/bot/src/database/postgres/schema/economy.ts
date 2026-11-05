import {
  bigint,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const economyAccount = pgTable(
  "economy_account",
  {
    guildId: text("guild_id").notNull(),
    memberId: text("member_id").notNull(),
    wallet: bigint("wallet", { mode: "number" }).notNull().default(0),
    bank: bigint("bank", { mode: "number" }).notNull().default(0),
    lastWorkAt: timestamp("last_work_at", { withTimezone: true }),
    lastDailyAt: timestamp("last_daily_at", { withTimezone: true }),
    dailyStreak: integer("daily_streak").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.guildId, table.memberId] })],
);

export const economyLedger = pgTable(
  "economy_ledger",
  {
    /** Ordre d'insertion strict : `created_at` peut être identique entre deux écritures. */
    seq: bigint("seq", { mode: "number" }).generatedAlwaysAsIdentity(),
    id: uuid("id").primaryKey(),
    guildId: text("guild_id").notNull(),
    memberId: text("member_id").notNull(),
    kind: text("kind").notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    walletAfter: bigint("wallet_after", { mode: "number" }).notNull(),
    bankAfter: bigint("bank_after", { mode: "number" }).notNull(),
    reason: text("reason").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("economy_ledger_idempotency_idx").on(table.guildId, table.idempotencyKey),
    index("economy_ledger_member_time_idx").on(table.guildId, table.memberId, table.seq),
  ],
);

export const guildTreasury = pgTable("guild_treasury", {
  guildId: text("guild_id").primaryKey(),
  balance: bigint("balance", { mode: "number" }).notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const treasuryEntry = pgTable(
  "treasury_entry",
  {
    /** Ordre d'insertion strict : `created_at` peut être identique entre deux écritures. */
    seq: bigint("seq", { mode: "number" }).generatedAlwaysAsIdentity(),
    id: uuid("id").primaryKey(),
    guildId: text("guild_id").notNull(),
    /** Signé : positif = entrée dans le trésor. */
    amount: bigint("amount", { mode: "number" }).notNull(),
    reason: text("reason").notNull(),
    memberId: text("member_id"),
    actorId: text("actor_id"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("treasury_entry_guild_idx").on(table.guildId, table.seq.desc())],
);

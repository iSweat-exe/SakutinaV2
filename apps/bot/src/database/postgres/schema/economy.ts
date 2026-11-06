import {
  bigint,
  date,
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
    casinoShares: bigint("casino_shares", { mode: "number" }).notNull().default(0),
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

/** La réserve du serveur (créée avec sa dotation de lancement par un déclencheur), et le budget des salaires du jour. */
export const guildTreasury = pgTable("guild_treasury", {
  guildId: text("guild_id").primaryKey(),
  balance: bigint("balance", { mode: "number" }).notNull().default(1_000_000),
  salaryDay: date("salary_day", { mode: "string" }),
  salaryBudget: bigint("salary_budget", { mode: "number" }),
  salaryPaid: bigint("salary_paid", { mode: "number" }).notNull().default(0),
  salaryActive: integer("salary_active").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Le compte du casino, sa cagnotte et ses actions. */
export const casinoFund = pgTable("casino_fund", {
  guildId: text("guild_id").primaryKey(),
  balance: bigint("balance", { mode: "number" }).notNull().default(0),
  jackpot: bigint("jackpot", { mode: "number" }).notNull().default(0),
  shares: bigint("shares", { mode: "number" }).notNull().default(1000),
  serverShares: bigint("server_shares", { mode: "number" }).notNull().default(1000),
  day: date("day", { mode: "string" }),
  dayStart: bigint("day_start", { mode: "number" }).notNull().default(0),
  dayNet: bigint("day_net", { mode: "number" }).notNull().default(0),
  weekNet: bigint("week_net", { mode: "number" }).notNull().default(0),
  carriedLoss: bigint("carried_loss", { mode: "number" }).notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const casinoEntry = pgTable(
  "casino_entry",
  {
    seq: bigint("seq", { mode: "number" }).generatedAlwaysAsIdentity(),
    id: uuid("id").primaryKey(),
    guildId: text("guild_id").notNull(),
    /** `casino` ou `jackpot`. */
    pool: text("pool").notNull(),
    /** Signé : positif = entrée. */
    amount: bigint("amount", { mode: "number" }).notNull(),
    reason: text("reason").notNull(),
    memberId: text("member_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("casino_entry_guild_idx").on(table.guildId, table.seq.desc())],
);

/** Bougies du cours de l'action Casino (centièmes de pièce). */
export const marketCandle = pgTable(
  "market_candle",
  {
    guildId: text("guild_id").notNull(),
    /** `15m` ou `1d`. */
    period: text("period").notNull(),
    bucket: timestamp("bucket", { withTimezone: true }).notNull(),
    open: bigint("open", { mode: "number" }).notNull(),
    high: bigint("high", { mode: "number" }).notNull(),
    low: bigint("low", { mode: "number" }).notNull(),
    close: bigint("close", { mode: "number" }).notNull(),
    volume: bigint("volume", { mode: "number" }).notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.guildId, table.period, table.bucket] })],
);

/** Passage du dimanche d'un serveur. */
export const economyWeekRun = pgTable(
  "economy_week_run",
  {
    guildId: text("guild_id").notNull(),
    week: date("week", { mode: "string" }).notNull(),
    membersTaxed: integer("members_taxed").notNull().default(0),
    threshold: bigint("threshold", { mode: "number" }).notNull().default(0),
    wealthTax: bigint("wealth_tax", { mode: "number" }).notNull().default(0),
    profit: bigint("profit", { mode: "number" }).notNull().default(0),
    dividends: bigint("dividends", { mode: "number" }).notNull().default(0),
    casinoTax: bigint("casino_tax", { mode: "number" }).notNull().default(0),
    carriedLoss: bigint("carried_loss", { mode: "number" }).notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.guildId, table.week] })],
);

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

export const interestRun = pgTable(
  "interest_run",
  {
    guildId: text("guild_id").notNull(),
    day: date("day", { mode: "string" }).notNull(),
    members: integer("members").notNull().default(0),
    wanted: bigint("wanted", { mode: "number" }).notNull().default(0),
    paid: bigint("paid", { mode: "number" }).notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.guildId, table.day] })],
);

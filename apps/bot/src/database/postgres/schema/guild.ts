import { boolean, integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Serveurs du bot, gestionnaires et réglages par serveur. Doit rester identique à
 * `migrations/0008_multi_server.sql` (les migrations font foi).
 */
export const botGuild = pgTable("bot_guild", {
  guildId: text("guild_id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon"),
  banner: text("banner"),
  ownerId: text("owner_id").notNull(),
  memberCount: integer("member_count").notNull().default(0),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const guildManager = pgTable(
  "guild_manager",
  {
    guildId: text("guild_id").notNull(),
    memberId: text("member_id").notNull(),
  },
  (table) => [primaryKey({ columns: [table.guildId, table.memberId] })],
);

export const guildSettings = pgTable("guild_settings", {
  guildId: text("guild_id").primaryKey(),
  adminRoleIds: text("admin_role_ids").array().notNull().default([]),
  moderatorRoleIds: text("moderator_role_ids").array().notNull().default([]),
  alertChannelId: text("alert_channel_id"),
  currencyName: text("currency_name").notNull().default("pièces"),
  startingBalance: integer("starting_balance").notNull().default(0),
  transferTaxPercent: integer("transfer_tax_percent").notNull().default(0),
  bankInterestPermille: integer("bank_interest_permille").notNull().default(0),
  salaryBudgetPermille: integer("salary_budget_permille").notNull().default(10),
  wealthTaxPermille: integer("wealth_tax_permille").notNull().default(5),
  idleTaxPermille: integer("idle_tax_permille").notNull().default(20),
  casinoSlotsEnabled: boolean("casino_slots_enabled").notNull().default(true),
  casinoSlotsMaxBet: integer("casino_slots_max_bet").notNull().default(500),
  casinoBlackjackEnabled: boolean("casino_blackjack_enabled").notNull().default(true),
  casinoBlackjackMaxBet: integer("casino_blackjack_max_bet").notNull().default(2000),
  casinoRouletteEnabled: boolean("casino_roulette_enabled").notNull().default(true),
  casinoRouletteMaxBet: integer("casino_roulette_max_bet").notNull().default(1000),
  casinoCoinflipEnabled: boolean("casino_coinflip_enabled").notNull().default(true),
  casinoCoinflipMaxBet: integer("casino_coinflip_max_bet").notNull().default(250),
  automodSpam: boolean("automod_spam").notNull().default(false),
  automodLinks: boolean("automod_links").notNull().default(false),
  automodWords: boolean("automod_words").notNull().default(false),
  automodMentions: boolean("automod_mentions").notNull().default(false),
  bannedWords: text("banned_words").array().notNull().default([]),
  defaultMuteMinutes: integer("default_mute_minutes").notNull().default(60),
  antiraidEnabled: boolean("antiraid_enabled").notNull().default(false),
  antiraidJoinThreshold: integer("antiraid_join_threshold").notNull().default(10),
  antiraidWindowSeconds: integer("antiraid_window_seconds").notNull().default(30),
  antiraidMinAccountAgeDays: integer("antiraid_min_account_age_days").notNull().default(7),
  antiraidAction: text("antiraid_action").notNull().default("quarantine"),
  antiraidLockChannels: boolean("antiraid_lock_channels").notNull().default(true),
  antiraidAlert: boolean("antiraid_alert").notNull().default(true),
  antiraidRaiseVerification: boolean("antiraid_raise_verification").notNull().default(false),
  casinoEnabled: boolean("casino_enabled").notNull().default(true),
  phaethonEnabled: boolean("phaethon_enabled").notNull().default(true),
  profilingEnabled: boolean("profiling_enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

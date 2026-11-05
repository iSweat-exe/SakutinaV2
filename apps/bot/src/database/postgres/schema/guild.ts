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
  dailyReward: integer("daily_reward").notNull().default(200),
  startingBalance: integer("starting_balance").notNull().default(0),
  transferTaxPercent: integer("transfer_tax_percent").notNull().default(0),
  bankInterestPermille: integer("bank_interest_permille").notNull().default(0),
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
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

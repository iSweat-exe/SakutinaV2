import { integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

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
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

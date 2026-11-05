import { index, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

/** Doit rester identique à `migrations/0006_moderation.sql` (les migrations font foi). */
export const moderationWarning = pgTable(
  "moderation_warning",
  {
    id: serial("id").primaryKey(),
    guildId: text("guild_id").notNull(),
    memberId: text("member_id").notNull(),
    moderatorId: text("moderator_id").notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("moderation_warning_member_idx").on(table.guildId, table.memberId, table.createdAt)],
);

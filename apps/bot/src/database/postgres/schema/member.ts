import { pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export const memberProfile = pgTable(
  "member_profile",
  {
    guildId: text("guild_id").notNull(),
    memberId: text("member_id").notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }),
    leftAt: timestamp("left_at", { withTimezone: true }),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
  },
  (table) => [primaryKey({ columns: [table.guildId, table.memberId] })],
);

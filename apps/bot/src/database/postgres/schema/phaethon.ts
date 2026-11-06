import {
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/** Doit rester identique à `migrations/0005_phaethon.sql` (les migrations font foi). */

export const socialEdgeDaily = pgTable(
  "social_edge_daily",
  {
    guildId: text("guild_id").notNull(),
    memberId: text("member_id").notNull(),
    targetId: text("target_id").notNull(),
    day: date("day", { mode: "string" }).notNull(),
    replies: integer("replies").notNull().default(0),
    mentions: integer("mentions").notNull().default(0),
    reactions: integer("reactions").notNull().default(0),
    voiceSeconds: integer("voice_seconds").notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.guildId, table.memberId, table.targetId, table.day] }),
    index("social_edge_daily_target_idx").on(table.guildId, table.targetId, table.day),
  ],
);

export const memberHourDaily = pgTable(
  "member_hour_daily",
  {
    guildId: text("guild_id").notNull(),
    memberId: text("member_id").notNull(),
    day: date("day", { mode: "string" }).notNull(),
    hour: smallint("hour").notNull(),
    messages: integer("messages").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.guildId, table.memberId, table.day, table.hour] })],
);

export const presenceStatusDaily = pgTable(
  "presence_status_daily",
  {
    guildId: text("guild_id").notNull(),
    memberId: text("member_id").notNull(),
    day: date("day", { mode: "string" }).notNull(),
    status: text("status").notNull(),
    seconds: integer("seconds").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.guildId, table.memberId, table.day, table.status] })],
);

export const presenceGameDaily = pgTable(
  "presence_game_daily",
  {
    guildId: text("guild_id").notNull(),
    memberId: text("member_id").notNull(),
    day: date("day", { mode: "string" }).notNull(),
    kind: text("kind").notNull(),
    name: text("name").notNull(),
    seconds: integer("seconds").notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.guildId, table.memberId, table.day, table.kind, table.name] }),
  ],
);

export const identityEvent = pgTable(
  "identity_event",
  {
    id: uuid("id").primaryKey(),
    guildId: text("guild_id").notNull(),
    memberId: text("member_id").notNull(),
    kind: text("kind").notNull(),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("identity_event_member_idx").on(table.guildId, table.memberId, table.occurredAt)],
);

export const phaethonAlert = pgTable(
  "phaethon_alert",
  {
    guildId: text("guild_id").notNull(),
    key: text("key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.guildId, table.key] })],
);

export const activityMonthly = pgTable(
  "activity_monthly",
  {
    guildId: text("guild_id").notNull(),
    memberId: text("member_id").notNull(),
    month: text("month").notNull(),
    activeDays: integer("active_days").notNull().default(0),
    messages: integer("messages").notNull().default(0),
    characters: integer("characters").notNull().default(0),
    replies: integer("replies").notNull().default(0),
    attachments: integer("attachments").notNull().default(0),
    mentions: integer("mentions").notNull().default(0),
    reactionsGiven: integer("reactions_given").notNull().default(0),
    reactionsReceived: integer("reactions_received").notNull().default(0),
    voiceSeconds: integer("voice_seconds").notNull().default(0),
    joins: integer("joins").notNull().default(0),
    leaves: integer("leaves").notNull().default(0),
    attributedInvites: integer("attributed_invites").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.guildId, table.memberId, table.month] })],
);

/** Décision d'un administrateur sur un compte, depuis le panneau. Doit rester identique à `migrations/0019_panel_phaethon.sql`. */
export const phaethonReview = pgTable(
  "phaethon_review",
  {
    guildId: text("guild_id").notNull(),
    memberId: text("member_id").notNull(),
    status: text("status").notNull(),
    score: integer("score").notNull().default(0),
    reviewedBy: text("reviewed_by").notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.guildId, table.memberId] }), index("phaethon_review_time_idx").on(table.reviewedAt)],
);

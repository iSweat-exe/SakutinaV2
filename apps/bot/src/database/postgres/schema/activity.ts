import { date, integer, pgTable, primaryKey, smallint, text } from "drizzle-orm/pg-core";

/**
 * Les propriétés portent les noms de `COUNTER_NAMES` : le dépôt s'en sert pour
 * écrire les mises à jour sans répéter chaque colonne. Doit rester identique à
 * `migrations/*.sql` (les migrations font foi).
 */
export const activityDaily = pgTable(
  "activity_daily",
  {
    guildId: text("guild_id").notNull(),
    memberId: text("member_id").notNull(),
    day: date("day", { mode: "string" }).notNull(),
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
  (table) => [primaryKey({ columns: [table.guildId, table.memberId, table.day] })],
);

export const activityChannelDaily = pgTable(
  "activity_channel_daily",
  {
    guildId: text("guild_id").notNull(),
    memberId: text("member_id").notNull(),
    channelId: text("channel_id").notNull(),
    day: date("day", { mode: "string" }).notNull(),
    messages: integer("messages").notNull().default(0),
    voiceSeconds: integer("voice_seconds").notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.guildId, table.memberId, table.channelId, table.day] }),
  ],
);

export const activityHourly = pgTable(
  "activity_hourly",
  {
    guildId: text("guild_id").notNull(),
    day: date("day", { mode: "string" }).notNull(),
    hour: smallint("hour").notNull(),
    messages: integer("messages").notNull().default(0),
    voiceSeconds: integer("voice_seconds").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.guildId, table.day, table.hour] })],
);

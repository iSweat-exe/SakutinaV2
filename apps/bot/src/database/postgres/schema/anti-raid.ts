import { boolean, index, integer, pgTable, primaryKey, smallint, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** Doit rester identique à `migrations/0021_anti_raid.sql` (les migrations font foi). Un raid et son bilan. */
export const raidEvent = pgTable(
  "raid_event",
  {
    id: uuid("id").primaryKey(),
    guildId: text("guild_id").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    trigger: text("trigger").notNull(),
    startedBy: text("started_by"),
    endedBy: text("ended_by"),
    joins: integer("joins").notNull().default(0),
    windowSeconds: integer("window_seconds").notNull(),
    action: text("action").notNull(),
    actioned: integer("actioned").notNull().default(0),
    failed: integer("failed").notNull().default(0),
    lockedChannels: integer("locked_channels").notNull().default(0),
    verificationBefore: smallint("verification_before"),
  },
  (table) => [index("raid_event_guild_idx").on(table.guildId, table.startedAt)],
);

/** Permission de @everyone d'un salon avant son verrouillage, à rétablir à la fin du raid. */
export const raidLockdownChannel = pgTable(
  "raid_lockdown_channel",
  {
    raidId: uuid("raid_id")
      .notNull()
      .references(() => raidEvent.id, { onDelete: "cascade" }),
    guildId: text("guild_id").notNull(),
    channelId: text("channel_id").notNull(),
    hadOverwrite: boolean("had_overwrite").notNull(),
    allow: text("allow").notNull().default("0"),
    deny: text("deny").notNull().default("0"),
  },
  (table) => [primaryKey({ columns: [table.raidId, table.channelId] })],
);

/** Demande du panneau (« verrouiller », « lever le raid »), exécutée par le bot. */
export const raidCommand = pgTable("raid_command", {
  id: uuid("id").primaryKey().defaultRandom(),
  guildId: text("guild_id").notNull(),
  action: text("action").notNull(),
  requestedBy: text("requested_by").notNull(),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull().default("pending"),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  error: text("error"),
});

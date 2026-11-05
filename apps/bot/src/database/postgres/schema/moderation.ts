import { index, integer, pgTable, serial, text, timestamp, uuid } from "drizzle-orm/pg-core";

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

/** Doit rester identique à `migrations/0012_moderation_panel.sql`. Un mute ou un bannissement et son état. */
export const moderationSanction = pgTable(
  "moderation_sanction",
  {
    id: serial("id").primaryKey(),
    guildId: text("guild_id").notNull(),
    memberId: text("member_id").notNull(),
    kind: text("kind").notNull(),
    /** `null` : posée dans Discord (auteur inconnu) ; `sakutina` : auto-modération. */
    moderatorId: text("moderator_id"),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedBy: text("revoked_by"),
  },
  (table) => [index("moderation_sanction_member_idx").on(table.guildId, table.memberId, table.kind)],
);

/** Demande du panneau « lever cette sanction », exécutée par le bot. */
export const moderationCommand = pgTable("moderation_command", {
  id: uuid("id").primaryKey().defaultRandom(),
  guildId: text("guild_id").notNull(),
  sanctionId: integer("sanction_id").notNull(),
  requestedBy: text("requested_by").notNull(),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull().default("pending"),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  error: text("error"),
});

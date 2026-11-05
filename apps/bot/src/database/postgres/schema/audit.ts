import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const auditEvent = pgTable(
  "audit_event",
  {
    id: uuid("id").primaryKey(),
    action: text("action").notNull(),
    guildId: text("guild_id").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    actorId: text("actor_id"),
    targetId: text("target_id"),
    metadata: jsonb("metadata").notNull().default({}),
  },
  (table) => [index("audit_event_guild_time_idx").on(table.guildId, table.occurredAt)],
);

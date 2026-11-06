import { integer, pgTable, primaryKey, text } from "drizzle-orm/pg-core";

/** Doit rester identique à `migrations/0022_modules_and_alerts.sql`. Salons où le bot peut écrire (choix du salon d'alertes). */
export const guildChannel = pgTable(
  "guild_channel",
  {
    guildId: text("guild_id").notNull(),
    channelId: text("channel_id").notNull(),
    name: text("name").notNull(),
    category: text("category"),
    position: integer("position").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.guildId, table.channelId] })],
);

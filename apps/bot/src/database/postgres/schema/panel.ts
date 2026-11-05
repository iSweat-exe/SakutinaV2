import { pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Administrateurs autorisés à ouvrir le panneau web. Doit rester identique à
 * `migrations/0007_panel_access.sql` (les migrations font foi). Le panneau n'y accède jamais
 * directement : il passe par les fonctions `panel_*`.
 */
export const panelAdmin = pgTable(
  "panel_admin",
  {
    guildId: text("guild_id").notNull(),
    discordId: text("discord_id").notNull(),
    role: text("role").notNull().default("admin"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.guildId, table.discordId] })],
);

import { readdirSync } from "node:fs";
import { join } from "node:path";

import type { Generated } from "../lib/generator.ts";
import { camel, kebab, snake } from "../lib/names.ts";
import { path, type Paths } from "../lib/paths.ts";
import { Plan } from "../lib/plan.ts";

/** Prochain numéro de migration : `0008` après `0007_…`. */
export function nextMigrationNumber(files: readonly string[]): string {
  const numbers = files.map((file) => /^(\d{4})_/.exec(file)?.[1]).filter((n): n is string => n !== undefined).map(Number);
  return String(Math.max(0, ...numbers) + 1).padStart(4, "0");
}

export const migrationFiles = (directory: string = path.migrations) => readdirSync(directory).filter((file) => /^\d{4}_.+\.sql$/.test(file));

export function tableMigrationSql(table: string, summary: string): string {
  return `-- ${summary}
-- Rappels : une migration appliquée ne se modifie jamais (en écrire une nouvelle) ; toute table a RLS ;
-- le dossier schema/ (Drizzle) reste identique (un test le vérifie) ; si la table contient de l'activité,
-- décider sa durée de conservation (30 jours par défaut) et l'ajouter à la purge de app/background-jobs.ts.

CREATE TABLE IF NOT EXISTS ${table} (
  guild_id text NOT NULL,
  member_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (guild_id, member_id)
);
--> statement-breakpoint
ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;
`;
}

export function tableSchemaSource(table: string, id: string, migration: string): string {
  return `import { pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

/** Doit rester identique à \`migrations/${migration}\` (les migrations font foi). */
export const ${id} = pgTable(
  ${JSON.stringify(table)},
  {
    guildId: text("guild_id").notNull(),
    memberId: text("member_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.guildId, table.memberId] })],
);
`;
}

export function planMigration(o: { name: string; table?: string; existing?: readonly string[] }, paths: Paths = path): Generated {
  const label = snake(o.name);
  if (!label) throw new Error("Donnez un nom à la migration (ex. : bun run new migration add_shop_items).");

  const number = nextMigrationNumber(o.existing ?? migrationFiles(paths.migrations));
  const file = `${number}_${label}.sql`;
  const plan = new Plan();

  if (o.table) {
    const table = snake(o.table);
    const id = camel(table);
    const schemaFile = kebab(table);

    plan
      .create(join(paths.migrations, file), tableMigrationSql(table, `Table ${table} : à décrire.`))
      .create(join(paths.botSrc, "database/postgres/schema", `${schemaFile}.ts`), tableSchemaSource(table, id, file))
      .edit(join(paths.botSrc, "database/postgres/schema/index.ts"), "export du schéma", (source) => {
        if (source.includes(`./${schemaFile}.ts`)) throw new Error(`schema/index.ts exporte déjà ./${schemaFile}.ts`);
        return `${source.replace(/\n*$/, "\n")}export { ${id} } from "./${schemaFile}.ts";\n`;
      });
  } else {
    plan.create(
      join(paths.migrations, file),
      `-- À décrire : ce que fait cette migration et pourquoi.
-- Rappels : une migration appliquée ne se modifie jamais (en écrire une nouvelle) ; toute nouvelle table
-- active RLS ; le dossier schema/ (Drizzle) reste identique (un test le vérifie).

`,
    );
  }

  return {
    plan,
    checks: [{ label: "tests de la base (migrations, dérive du schéma, RLS)", command: ["bun", "test", "test/database"], cwd: paths.bot }],
    next: [
      `Écrire le SQL dans apps/bot/src/database/postgres/migrations/${file}${o.table ? " (colonnes et clé primaire à adapter, puis mêmes colonnes dans schema/)" : ""}.`,
      "Les migrations s'appliquent seules au démarrage du bot ; ne jamais modifier une migration déjà déployée.",
    ],
  };
}

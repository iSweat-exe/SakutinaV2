import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { is } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/pglite";

import type { Database } from "@/database/postgres/connection.ts";
import { migrate } from "@/database/postgres/migrate.ts";
import * as schema from "@/database/postgres/schema/index.ts";

/**
 * Les migrations font foi, le dossier `schema/` (Drizzle) doit leur rester identique
 * (docs/architecture.md). Ce test compare les deux : une migration qui ajoute une table
 * ou une colonne sans mettre `schema/` à jour échoue ici, avec le détail de l'écart.
 */
let client: PGlite;

beforeAll(async () => {
  client = new PGlite();
  await migrate(drizzle(client) as unknown as Database);
});

afterAll(async () => {
  await client.close();
});

/** Types Drizzle → `information_schema.columns.data_type`. */
const POSTGRES_TYPE: Record<string, string> = {
  serial: "integer",
  smallserial: "smallint",
  bigserial: "bigint",
  "timestamp with time zone": "timestamp with time zone",
};

const tables = Object.values(schema).filter((value) => is(value, PgTable)) as unknown as PgTable[];

test("chaque table de la base a sa définition Drizzle, et réciproquement", async () => {
  const result = await client.query<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name <> 'schema_migrations'",
  );
  const inDatabase = result.rows.map((row) => row.table_name).sort();
  const inSchema = tables.map((table) => getTableConfig(table).name).sort();

  expect(inSchema, "tables définies dans schema/ mais absentes des migrations (ou l'inverse)").toEqual(inDatabase);
});

for (const table of tables) {
  const config = getTableConfig(table);

  test(`${config.name} : colonnes, types et nullabilité identiques aux migrations`, async () => {
    const result = await client.query<{ column_name: string; data_type: string; is_nullable: string }>(
      "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1",
      [config.name],
    );
    const actual = new Map(result.rows.map((row) => [row.column_name, row]));
    const declared = new Map(config.columns.map((column) => [column.name, column]));

    expect([...declared.keys()].sort(), "colonnes de schema/ vs migrations").toEqual([...actual.keys()].sort());

    for (const [name, column] of declared) {
      const row = actual.get(name)!;
      const type = column.getSQLType();

      expect(row.data_type, `${config.name}.${name} : type`).toBe(POSTGRES_TYPE[type] ?? type);
      expect(row.is_nullable === "NO", `${config.name}.${name} : NOT NULL`).toBe(column.notNull);
    }
  });
}

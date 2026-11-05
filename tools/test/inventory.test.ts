import { PGlite } from "@electric-sql/pglite";
import { expect, test } from "bun:test";
import { readdirSync } from "node:fs";

import { applyMigrations } from "../lib/db.ts";
import { parseEnvExample, summarize } from "../lib/inventory-data.ts";
import { renderInventory } from "../lib/inventory-render.ts";
import { collectInventory } from "../lib/inventory-data.ts";
import { path } from "../lib/paths.ts";

test("les commentaires précèdent la variable qu'ils décrivent", () => {
  const rows = parseEnvExample("# Jeton Discord.\n# Ne jamais commiter.\nDISCORD_TOKEN=\n\nPORT=3000\n# Orphelin\n\nNODE_ENV=development\n");

  expect(rows).toEqual([
    { name: "DISCORD_TOKEN", example: "", description: "Jeton Discord. Ne jamais commiter." },
    { name: "PORT", example: "3000", description: "" },
    { name: "NODE_ENV", example: "development", description: "" },
  ]);
});

test("une migration sans commentaire est résumée par ses tables", () => {
  expect(summarize("CREATE TABLE IF NOT EXISTS a (x int);\n--> statement-breakpoint\nCREATE TABLE IF NOT EXISTS b (y int);")).toBe("Crée a, b");
  expect(summarize("ALTER TABLE t ADD COLUMN IF NOT EXISTS c int;")).toBe("modifie t");
  expect(summarize("-- Mon rôle\nSELECT 1;")).toBe("Mon rôle");
  // Un commentaire au milieu du fichier décrit une instruction, pas la migration.
  expect(summarize("CREATE TABLE IF NOT EXISTS a (x int);\n--> statement-breakpoint\n-- Détail\nCREATE TABLE IF NOT EXISTS b (y int);")).toBe("Crée a, b");
});

test("les outils appliquent exactement les migrations du dépôt, dans l'ordre", async () => {
  const client = new PGlite();
  const applied = await applyMigrations(client);
  await client.close();

  expect(applied).toEqual(readdirSync(path.migrations).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort());
});

test("l'inventaire reflète le dépôt et son rendu est stable", async () => {
  const inventory = await collectInventory();
  const markdown = renderInventory(inventory);

  expect(inventory.commands.length).toBeGreaterThan(0);
  expect(inventory.commands.every((command) => command.file.startsWith("apps/bot/src/discord/commands/"))).toBe(true);
  expect(inventory.events.every((event) => event.file !== "?")).toBe(true);
  // Toute table du bot doit avoir RLS : c'est ce qui la ferme à `anon` sur Supabase.
  expect(inventory.tables.filter((table) => !table.rls).map((table) => table.name)).toEqual([]);
  // Toute fonction panel_* est SECURITY DEFINER (sinon elle ne pourrait pas lire les tables fermées).
  expect(inventory.functions.filter((fn) => fn.name.startsWith("panel_") && !fn.securityDefiner)).toEqual([]);
  expect(renderInventory(inventory)).toBe(markdown);
});

#!/usr/bin/env bun
/**
 * `bun run inventory` écrit docs/inventory.md ; `--check` échoue s'il est périmé ;
 * `--stdout` l'affiche sans l'écrire.
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { parseArgs, flag } from "./lib/args.ts";
import { collectInventory } from "./lib/inventory-data.ts";
import { renderInventory } from "./lib/inventory-render.ts";
import { path } from "./lib/paths.ts";
import { fail, ok } from "./lib/term.ts";

const args = parseArgs(Bun.argv.slice(2));
const target = join(path.docs, "inventory.md");
const next = renderInventory(await collectInventory());

if (flag(args, "stdout")) {
  process.stdout.write(next);
} else if (flag(args, "check")) {
  const current = await readFile(target, "utf8").catch(() => "");

  if (current !== next) {
    console.error(fail("docs/inventory.md est périmé. Lancez `bun run inventory` et commitez le résultat."));
    process.exitCode = 1;
  } else {
    console.log(ok("docs/inventory.md est à jour"));
  }
} else {
  await writeFile(target, next);
  console.log(ok(`docs/inventory.md écrit (${next.split("\n").length} lignes)`));
}

import { afterAll, beforeEach, expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { planCommand } from "../generators/command.ts";
import { planEvent, resolveEvent } from "../generators/event.ts";
import { nextMigrationNumber, planMigration } from "../generators/migration.ts";
import { planPanelFunction } from "../generators/panel-fn.ts";
import { pathsFor, ROOT } from "../lib/paths.ts";

/**
 * Les générateurs modifient des fichiers existants (registre, textes, tests) : on les essaie sur une
 * copie jetable des fichiers réels, pour qu'un changement de leur mise en forme casse CE test, pas
 * le prochain développeur qui lance `bun run new`.
 */
const TOUCHED = [
  "apps/bot/src/discord/commands/index.ts",
  "apps/bot/src/discord/messages.ts",
  "apps/bot/src/discord/events/index.ts",
  "apps/bot/src/database/postgres/schema/index.ts",
  "apps/bot/test/discord/commands/registry.test.ts",
];

const roots: string[] = [];
let root = "";

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "sakutina-gen-"));
  roots.push(root);
  for (const file of TOUCHED) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    cpSync(join(ROOT, file), join(root, file));
  }
  mkdirSync(join(root, "apps/bot/src/database/postgres/migrations"), { recursive: true });
  for (const file of readdirSync(join(ROOT, "apps/bot/src/database/postgres/migrations"))) {
    cpSync(join(ROOT, "apps/bot/src/database/postgres/migrations", file), join(root, "apps/bot/src/database/postgres/migrations", file));
  }
});

afterAll(() => {
  for (const dir of roots) rmSync(dir, { recursive: true, force: true });
});

const read = (file: string) => readFileSync(join(root, file), "utf8");

/** Nombre de commandes du dépôt aujourd'hui, lu dans le test du registre : il avance à chaque commande ajoutée. */
const COMMANDS = Number(/toHaveLength\((\d+)\)/.exec(readFileSync(join(ROOT, "apps/bot/test/discord/commands/registry.test.ts"), "utf8"))?.[1]);

/** Numéro que recevra la prochaine migration du dépôt (il avance à chaque migration ajoutée). */
const NEXT = nextMigrationNumber(readdirSync(join(ROOT, "apps/bot/src/database/postgres/migrations")));

test("command : crée le fichier et son test, enregistre dans la section, ajoute les textes et met à jour le test du registre", async () => {
  const { plan } = planCommand({ group: "info", name: "hello-world", role: "admin", description: "Dire bonjour", isPublic: false }, pathsFor(root));
  await plan.apply({ dryRun: false });

  const command = read("apps/bot/src/discord/commands/general/hello-world.ts");
  expect(command).toContain("export const helloWorldCommand: Command");
  expect(command).toContain('.setName("hello-world")');
  expect(command).toContain('requiredRole: "admin"');
  expect(command).toContain("respondPrivately");

  const index = read("apps/bot/src/discord/commands/index.ts");
  expect(index).toContain('import { helloWorldCommand } from "@/discord/commands/general/hello-world.ts";');
  expect(index).toContain("commands: [userInfoCommand, avatarCommand, pingCommand, helloWorldCommand],");

  expect(read("apps/bot/src/discord/messages.ts")).toMatch(/helloWorld: \{\n\s+description: "Dire bonjour",\n\s+title: "Hello world",/);

  const registry = read("apps/bot/test/discord/commands/registry.test.ts");
  expect(registry).toContain('["info", ["user", "avatar", "ping", "hello-world"]]');
  expect(registry).toContain(`au lieu de ${COMMANDS + 1}`);
  expect(registry).toContain(`toHaveLength(${COMMANDS + 1})`);

  expect(read("apps/bot/test/discord/commands/general/hello-world.test.ts")).toContain('findCommand("info", "hello-world")');
});

test("command : une section multiligne (server) est complétée ligne à ligne", async () => {
  const { plan } = planCommand({ group: "server", name: "roles", role: "member", isPublic: true }, pathsFor(root));
  await plan.apply({ dryRun: false });

  expect(read("apps/bot/src/discord/commands/index.ts")).toMatch(/healthCommand,\n\s+rolesCommand,\n\s+\],/);
  expect(read("apps/bot/src/discord/commands/general/roles.ts")).toContain('import { respond } from "@/discord/ui/replies.ts";');
});

test("command : refuse une section inconnue, un doublon, un nom ou un rôle invalide", () => {
  const paths = pathsFor(root);
  const base = { role: "member", isPublic: false };

  expect(() => planCommand({ ...base, group: "nope", name: "x" }, paths)).toThrow(/Section « nope » inconnue/);
  expect(() => planCommand({ ...base, group: "info", name: "ping" }, paths)).toThrow(/existe déjà/);
  expect(() => planCommand({ ...base, group: "info", name: "Mauvais Nom" }, paths)).toThrow(/invalide/);
  expect(() => planCommand({ ...base, group: "info", name: "x", role: "dieu" }, paths)).toThrow(/Rôle « dieu » inconnu/);
});

test("rien n'est écrit si une modification échoue, et rien n'est écrasé", async () => {
  // Un registre dont la section n'existe plus : l'édition échoue, le fichier créé ne doit pas apparaître.
  const registry = join(root, "apps/bot/src/discord/commands/index.ts");
  await Bun.write(registry, readFileSync(registry, "utf8").replace('name: "info"', 'name: "renamed"'));

  const { plan } = planCommand({ group: "info", name: "orphan", role: "member", isPublic: false }, pathsFor(root));
  await expect(plan.apply({ dryRun: false })).rejects.toThrow(/ancre introuvable/);
  expect(existsSync(join(root, "apps/bot/src/discord/commands/general/orphan.ts"))).toBe(false);

  // Deux générations de suite restent cohérentes (le nombre de commandes se lit dans le test du registre).
  await planCommand({ group: "server", name: "first", role: "member", isPublic: false }, pathsFor(root)).plan.apply({ dryRun: false });
  await planCommand({ group: "server", name: "second", role: "member", isPublic: false }, pathsFor(root)).plan.apply({ dryRun: false });
  expect(read("apps/bot/test/discord/commands/registry.test.ts")).toContain(`toHaveLength(${COMMANDS + 2})`);

  // Un fichier existant n'est jamais écrasé, et rien d'autre n'est alors modifié.
  const before = read("apps/bot/src/discord/commands/index.ts");
  await expect(planCommand({ group: "server", name: "first", role: "member", isPublic: false, dir: "general" }, pathsFor(root)).plan.apply({ dryRun: false })).rejects.toThrow(/existe déjà/);
  expect(read("apps/bot/src/discord/commands/index.ts")).toBe(before);
});

test("--dry-run n'écrit rien", async () => {
  const { plan } = planCommand({ group: "info", name: "dry", role: "member", isPublic: false }, pathsFor(root));
  await plan.apply({ dryRun: true });
  expect(existsSync(join(root, "apps/bot/src/discord/commands/general/dry.ts"))).toBe(false);
});

test("event : nom discord.js résolu quelle que soit la casse, fichier en kebab-case, enregistré dans la liste", async () => {
  const events = { GuildBanAdd: "guildBanAdd", MessageCreate: "messageCreate" };
  expect(resolveEvent("GuildBanAdd", events)).toEqual({ key: "GuildBanAdd", value: "guildBanAdd" });
  expect(resolveEvent("guildbanadd", events)?.key).toBe("GuildBanAdd");
  expect(resolveEvent("inconnu", events)).toBeNull();

  const { plan } = planEvent({ event: "guildBanAdd", once: false, events }, pathsFor(root));
  await plan.apply({ dryRun: false });

  expect(read("apps/bot/src/discord/events/guild-ban-add.ts")).toContain("export const guildBanAdd = defineEvent({\n  name: Events.GuildBanAdd,");
  const index = read("apps/bot/src/discord/events/index.ts");
  expect(index).toContain('import { guildBanAdd } from "@/discord/events/guild-ban-add.ts";');
  // Ajouté en fin de liste, quel que soit le dernier événement existant.
  expect(index).toMatch(/\w+,\n\s+guildBanAdd,\n\] as const;/);
});

test("migration : numéro suivant, avec --table la définition Drizzle est créée et exportée", async () => {
  expect(nextMigrationNumber([])).toBe("0001");
  expect(nextMigrationNumber(["0001_a.sql", "0009_b.sql", "README.md"])).toBe("0010");

  const { plan } = planMigration({ name: "Shop Items", table: "shop_item" }, pathsFor(root));
  await plan.apply({ dryRun: false });

  const files = readdirSync(join(root, "apps/bot/src/database/postgres/migrations"));
  expect(files).toContain(`${NEXT}_shop_items.sql`);
  const sql = read(`apps/bot/src/database/postgres/migrations/${NEXT}_shop_items.sql`);
  expect(sql).toContain("CREATE TABLE IF NOT EXISTS shop_item");
  expect(sql).toContain("ALTER TABLE shop_item ENABLE ROW LEVEL SECURITY;");
  expect(read("apps/bot/src/database/postgres/schema/shop-item.ts")).toContain('export const shopItem = pgTable(');
  expect(read("apps/bot/src/database/postgres/schema/index.ts")).toContain('export { shopItem } from "./shop-item.ts";');
});

test("panel-fn : migration sécurisée, test de base, lecteur et validation côté panneau", async () => {
  const { plan } = planPanelFunction({ name: "panel_economy-summary" }, pathsFor(root));
  await plan.apply({ dryRun: false });

  const sql = read(`apps/bot/src/database/postgres/migrations/${NEXT}_panel_economy_summary.sql`);
  expect(sql).toContain("CREATE OR REPLACE FUNCTION panel_economy_summary(p_guild_id text) RETURNS jsonb");
  expect(sql).toContain("SECURITY DEFINER SET search_path = public, pg_temp");
  expect(sql).toContain("PERFORM panel_assert_admin(p_guild_id);");
  expect(sql).toContain("REVOKE ALL ON FUNCTION panel_economy_summary(text) FROM PUBLIC;");

  expect(read("apps/panel/src/lib/panel-db/economy-summary.ts")).toContain('callPanelFunction("panel_economy_summary", {}, parseEconomySummary)');
  expect(read("apps/panel/src/lib/panel-db/economy-summary-schema.ts")).toContain("export function parseEconomySummary");
  expect(existsSync(join(root, "apps/bot/test/database/postgres/panel-economy-summary.test.ts"))).toBe(true);
});

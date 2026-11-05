import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/pglite";

import type { Database } from "@/database/postgres/connection.ts";
import { migrate } from "@/database/postgres/migrate.ts";
import { actAs, installFakeSupabaseAuth, isForbidden } from "../../support/fake-supabase.ts";

/**
 * Garde-fous valables pour TOUTE fonction `panel_*`, présente ou future : le panneau n'a
 * d'autre protection que celle de ces fonctions (docs/architecture.md, « Panneau web »).
 * Ajouter une fonction (`bun run new panel-fn`) l'inscrit automatiquement ici.
 */

/** Aides internes : elles identifient l'appelant, elles ne renvoient pas de données. */
const HELPERS = new Set(["panel_role", "panel_assert_admin", "panel_assert_signed_in", "panel_caller_discord_id", "panel_automod_json"]);

/**
 * Fonctions « de l'appelant » : sans `p_guild_id`, elles ne renvoient que ce qui concerne la personne
 * connectée (la liste de ses serveurs). Première instruction : `PERFORM panel_assert_signed_in()`.
 * Toute autre fonction est une fonction d'un serveur, soumise à `panel_assert_admin(p_guild_id)`.
 */
const SELF = new Set(["panel_my_guilds"]);

const MIGRATIONS = new URL("../../../src/database/postgres/migrations/", import.meta.url);
const sql = readdirSync(MIGRATIONS)
  .filter((file) => /^\d{4}_.+\.sql$/.test(file))
  .sort()
  .map((file) => readFileSync(new URL(file, MIGRATIONS), "utf8"))
  .join("\n");

/** Définitions `CREATE [OR REPLACE] FUNCTION panel_x(...) ... $$ corps $$;`. */
const definitions = [...sql.matchAll(/CREATE (?:OR REPLACE )?FUNCTION (panel_\w+)\(([^)]*)\)([\s\S]*?)\$\$([\s\S]*?)\$\$;/g)].map((match) => ({
  name: match[1]!,
  header: match[3]!,
  body: match[4]!,
}));
const dataFunctions = definitions.filter((definition) => !HELPERS.has(definition.name) && !SELF.has(definition.name));
const selfFunctions = definitions.filter((definition) => SELF.has(definition.name));
const firstStatementOf = (body: string) => body.replace(/^\s*(?:DECLARE[\s\S]*?)?BEGIN/i, "").trim().split(";")[0]!.trim();

test("il existe des fonctions de données à contrôler", () => {
  expect(dataFunctions.length).toBeGreaterThan(0);
});

for (const definition of definitions) {
  test(`${definition.name} : SECURITY DEFINER avec un search_path fixé`, () => {
    // Sans search_path fixé, une fonction SECURITY DEFINER peut être détournée par un objet homonyme.
    expect(definition.header).toContain("SECURITY DEFINER");
    expect(definition.header).toMatch(/SET search_path = public, pg_temp/);
  });

  test(`${definition.name} : EXECUTE retiré à PUBLIC`, () => {
    const revoked = [...sql.matchAll(/REVOKE ALL ON FUNCTION([^;]*?)FROM PUBLIC;/g)].some((match) =>
      new RegExp(`\\b${definition.name}\\(`).test(match[1]!),
    );

    expect(revoked, `${definition.name} doit figurer dans un REVOKE ALL … FROM PUBLIC`).toBe(true);
  });
}

for (const definition of dataFunctions) {
  test(`${definition.name} : vérifie l'administrateur avant toute lecture`, () => {
    expect(firstStatementOf(definition.body), "la première instruction doit être PERFORM panel_assert_admin(p_guild_id)").toBe(
      "PERFORM panel_assert_admin(p_guild_id)",
    );
  });
}

for (const definition of selfFunctions) {
  test(`${definition.name} : vérifie la session Discord avant toute lecture`, () => {
    expect(firstStatementOf(definition.body), "la première instruction doit être PERFORM panel_assert_signed_in()").toBe(
      "PERFORM panel_assert_signed_in()",
    );
  });
}

let client: PGlite;
const OWNER = "11111111-1111-1111-1111-111111111111";
const STRANGER = "22222222-2222-2222-2222-222222222222";
const ELSEWHERE = "33333333-3333-3333-3333-333333333333";

beforeAll(async () => {
  client = new PGlite();
  await migrate(drizzle(client) as unknown as Database);
  await installFakeSupabaseAuth(client);
  await client.exec(`
    INSERT INTO auth.identities VALUES
      ('${OWNER}', 'discord', 'd-owner'), ('${STRANGER}', 'discord', 'd-stranger'), ('${ELSEWHERE}', 'discord', 'd-elsewhere');
    INSERT INTO panel_admin (guild_id, discord_id, role) VALUES ('g', 'd-owner', 'owner'), ('autre', 'd-elsewhere', 'admin');
  `);
});

afterAll(async () => {
  await client.close();
});

test("chaque fonction de données refuse un inconnu, un anonyme et l'administrateur d'un autre serveur", async () => {
  const signatures = await client.query<{ name: string; required: number; first: string }>(
    `SELECT proname AS name, pronargs - pronargdefaults AS required, split_part(pg_get_function_arguments(oid), ' ', 1) AS first
     FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname LIKE 'panel\\_%'`,
  );

  for (const fn of signatures.rows.filter((row) => !HELPERS.has(row.name) && !SELF.has(row.name))) {
    expect(fn.first, `${fn.name} : le premier argument doit être p_guild_id`).toBe("p_guild_id");
    expect(fn.required, `${fn.name} : les arguments après p_guild_id doivent avoir une valeur par défaut`).toBe(1);

    for (const user of [STRANGER, null, ELSEWHERE]) {
      await actAs(client, user);
      expect(await isForbidden(client, `SELECT ${fn.name}('g')`), `${fn.name} ouvert à ${user ?? "un anonyme"}`).toBe(true);
    }

    // L'administrateur du bon serveur, lui, n'est pas refusé.
    await actAs(client, OWNER);
    expect(await isForbidden(client, `SELECT ${fn.name}('g')`), `${fn.name} refuse son propre administrateur`).toBe(false);
  }
});

test("chaque fonction de l'appelant est sans argument et refuse un anonyme", async () => {
  const signatures = await client.query<{ name: string; args: number }>(
    `SELECT proname AS name, pronargs AS args FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname LIKE 'panel\\_%'`,
  );
  const self = signatures.rows.filter((row) => SELF.has(row.name));

  expect(self.map((row) => row.name).sort()).toEqual([...SELF].sort());

  for (const fn of self) {
    expect(fn.args, `${fn.name} : une fonction de l'appelant ne prend aucun argument`).toBe(0);

    await actAs(client, null);
    expect(await isForbidden(client, `SELECT ${fn.name}()`), `${fn.name} ouvert à un anonyme`).toBe(true);

    await actAs(client, STRANGER);
    expect(await isForbidden(client, `SELECT ${fn.name}()`), `${fn.name} refuse une session Discord`).toBe(false);
  }
});

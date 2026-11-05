import { join } from "node:path";

import { camel, kebab, snake } from "../lib/names.ts";
import type { Generated } from "../lib/generator.ts";
import { path, type Paths } from "../lib/paths.ts";
import { Plan } from "../lib/plan.ts";
import { migrationFiles, nextMigrationNumber } from "./migration.ts";

const pascal = (value: string) => camel(value).replace(/^./, (c) => c.toUpperCase());

export function panelFunctionSql(fn: string, summary: string): string {
  return `-- Panneau : ${summary}. Lecture seule, réservée aux administrateurs du serveur.
-- Le panneau n'a aucun accès direct aux tables : cette fonction est sa seule porte d'entrée.
-- Garde-fous vérifiés par test/database/postgres/panel-functions.test.ts : SECURITY DEFINER avec search_path
-- fixé, première instruction = PERFORM panel_assert_admin, EXECUTE retiré à PUBLIC.

CREATE OR REPLACE FUNCTION ${fn}(p_guild_id text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM panel_assert_admin(p_guild_id);

  RETURN jsonb_build_object(
    'generated_at', now()
    -- À compléter : agrégats prêts à afficher. Toujours filtrer sur p_guild_id ; pas de lignes brutes inutiles.
  );
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION ${fn}(text) FROM PUBLIC;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION ${fn}(text) FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION ${fn}(text) TO authenticated;
  END IF;
END;
$$;
`;
}

export function dbTestSource(fn: string): string {
  return `import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { drizzle } from "drizzle-orm/pglite";

import type { Database } from "@/database/postgres/connection.ts";
import { migrate } from "@/database/postgres/migrate.ts";
import { actAs, installFakeSupabaseAuth } from "../../support/fake-supabase.ts";

// Le refus des non-administrateurs est déjà vérifié pour toute fonction panel_* par
// panel-functions.test.ts : ici, le contenu.
const ADMIN = "11111111-1111-1111-1111-111111111111";
let client: PGlite;

beforeAll(async () => {
  client = new PGlite();
  await migrate(drizzle(client) as unknown as Database);
  await installFakeSupabaseAuth(client);
  await client.exec(\`
    INSERT INTO auth.identities VALUES ('\${ADMIN}', 'discord', 'd-admin');
    INSERT INTO panel_admin (guild_id, discord_id, role) VALUES ('g', 'd-admin', 'admin');
    -- À compléter : lignes de test pour les tables lues par ${fn}.
  \`);
});

afterAll(async () => {
  await client.close();
});

test("${fn} renvoie ses données à un administrateur", async () => {
  await actAs(client, ADMIN);
  const { rows } = await client.query<{ result: Record<string, unknown> }>("SELECT ${fn}('g') AS result");

  expect(rows[0]?.result.generated_at).toBeString();
  // À compléter : vérifier chaque agrégat, et qu'un autre serveur n'est jamais mélangé (guild_id).
});
`;
}

export function schemaSource(type: string, fn: string): string {
  return `/** Forme du JSON renvoyé par \`${fn}\`, et sa validation (aucune entrée/sortie). */
export type ${type} = Readonly<{
  generatedAt: string;
}>;

/** À compléter avec les champs de la fonction SQL ; refuser (null) tout ce qui n'a pas la forme attendue. */
export function parse${type}(value: unknown): ${type} | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const v = value as Record<string, unknown>;

  if (typeof v.generated_at !== "string") {
    return null;
  }

  return { generatedAt: v.generated_at };
}
`;
}

export function readerSource(type: string, fn: string, file: string): string {
  return `import "server-only";
import { parse${type}, type ${type} } from "./${file}-schema";
import { callPanelFunction } from "./rpc";

/** Appelle \`${fn}\` avec la session de l'utilisateur. Lève PanelForbiddenError / PanelDataError. */
export function get${type}(): Promise<${type}> {
  return callPanelFunction(${JSON.stringify(fn)}, {}, parse${type});
}
`;
}

export function panelTestSource(type: string, file: string): string {
  return `import { expect, test } from "bun:test";
import { parse${type} } from "./${file}-schema";

test("parse${type} accepte la forme de la fonction SQL", () => {
  expect(parse${type}({ generated_at: "2026-11-05T10:00:00Z" })?.generatedAt).toBe("2026-11-05T10:00:00Z");
});

test("parse${type} refuse ce qui n'a pas la forme attendue", () => {
  expect(parse${type}(null)).toBeNull();
  expect(parse${type}({})).toBeNull();
  expect(parse${type}({ generated_at: 1 })).toBeNull();
});
`;
}

export function planPanelFunction(o: { name: string; summary?: string; existing?: readonly string[] }, paths: Paths = path): Generated {
  const base = snake(o.name.replace(/^panel[-_]/, ""));
  if (!base) throw new Error("Donnez un nom à la fonction (ex. : bun run new panel-fn economy_summary).");

  const fn = `panel_${base}`;
  const file = kebab(base);
  const type = pascal(base);
  const migration = `${nextMigrationNumber(o.existing ?? migrationFiles(paths.migrations))}_${fn}.sql`;
  const lib = join(paths.panelSrc, "lib/panel-db");

  const plan = new Plan()
    .create(join(paths.migrations, migration), panelFunctionSql(fn, o.summary ?? base.replaceAll("_", " ")))
    .create(join(paths.botTest, "database/postgres", `panel-${file}.test.ts`), dbTestSource(fn))
    .create(join(lib, `${file}-schema.ts`), schemaSource(type, fn))
    .create(join(lib, `${file}.ts`), readerSource(type, fn, file))
    .create(join(lib, `${file}.test.ts`), panelTestSource(type, file));

  return {
    plan,
    checks: [
      { label: "tests de la base (garde-fous panel_*, dérive)", command: ["bun", "test", "test/database"], cwd: paths.bot },
      { label: "tests du panneau", command: ["bun", "run", "test"], cwd: paths.panel },
    ],
    next: [
      `Compléter le SQL de ${fn} dans apps/bot/src/database/postgres/migrations/${migration}, puis les champs de ${type} (${file}-schema.ts) et les tests.`,
      `Afficher les données : appeler get${type}() depuis un composant serveur sous <Suspense> (modèle : components/dashboard/dashboard-data.tsx).`,
      "Puis passer la section concernée à wired: true dans apps/panel/src/lib/features.ts.",
    ],
  };
}

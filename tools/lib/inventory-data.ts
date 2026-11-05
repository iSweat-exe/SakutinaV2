import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { PGlite } from "@electric-sql/pglite";

import { events } from "../../apps/bot/src/discord/events/index.ts";
import { groups } from "../../apps/bot/src/discord/commands/index.ts";
import { applyMigrations, readMigrations } from "./db.ts";
import { path, ROOT } from "./paths.ts";

export type CommandRow = Readonly<{ command: string; role: string; options: string; file: string }>;
export type EventRow = Readonly<{ name: string; once: boolean; file: string }>;
export type ColumnRow = Readonly<{ name: string; type: string; nullable: boolean; primaryKey: boolean }>;
export type TableRow = Readonly<{ name: string; rls: boolean; columns: readonly ColumnRow[] }>;
export type FunctionRow = Readonly<{ name: string; args: string; securityDefiner: boolean }>;
export type MigrationRow = Readonly<{ name: string; summary: string }>;
export type RouteRow = Readonly<{ route: string; file: string }>;
export type FeatureRow = Readonly<{ key: string; wired: boolean; needs: string }>;
export type EnvRow = Readonly<{ name: string; example: string; description: string }>;
export type ScriptRow = Readonly<{ name: string; command: string }>;

export type Inventory = Readonly<{
  commands: readonly CommandRow[];
  events: readonly EventRow[];
  migrations: readonly MigrationRow[];
  tables: readonly TableRow[];
  functions: readonly FunctionRow[];
  routes: readonly RouteRow[];
  features: readonly FeatureRow[];
  env: Readonly<Record<string, readonly EnvRow[]>>;
  scripts: readonly ScriptRow[];
}>;

const OPTION_TYPES: Record<number, string> = {
  3: "texte", 4: "entier", 5: "booléen", 6: "membre", 7: "salon", 8: "rôle", 9: "mention", 10: "nombre", 11: "fichier",
};

const rel = (absolute: string) => relative(ROOT, absolute).split(sep).join("/");

/** `import { xCommand } from "@/discord/commands/dir/x.ts"` → identifiant → fichier. */
async function importMap(indexFile: string, prefix: string): Promise<Map<string, string>> {
  const source = await readFile(indexFile, "utf8");
  const map = new Map<string, string>();

  for (const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"@\/([^"]+)"/g)) {
    if (!match[2]!.startsWith(prefix)) continue;
    for (const identifier of match[1]!.split(",").map((part) => part.trim().replace(/^type\s+/, "")).filter(Boolean)) {
      map.set(identifier, join(path.botSrc, match[2]!));
    }
  }

  return map;
}

/** Retrouve le fichier qui exporte `value` en important les fichiers listés par l'index. */
async function fileOf(value: unknown, imports: Map<string, string>): Promise<string> {
  for (const [identifier, file] of imports) {
    const module = (await import(file)) as Record<string, unknown>;
    if (module[identifier] === value) return rel(file);
  }
  return "?";
}

async function collectCommands(): Promise<CommandRow[]> {
  const imports = await importMap(join(path.botSrc, "discord/commands/index.ts"), "discord/commands/");
  const rows: CommandRow[] = [];

  for (const group of groups) {
    for (const command of group.commands) {
      const options = (command.definition.options ?? []) as Array<{ name: string; type: number; required?: boolean }>;
      rows.push({
        command: `/${group.name} ${command.definition.name}`,
        role: command.requiredRole,
        options: options.map((o) => `${o.name}${o.required ? "*" : ""}: ${OPTION_TYPES[o.type] ?? o.type}`).join(", "),
        file: await fileOf(command, imports),
      });
    }
  }

  return rows;
}

async function collectEvents(): Promise<EventRow[]> {
  const imports = await importMap(join(path.botSrc, "discord/events/index.ts"), "discord/events/");
  const rows: EventRow[] = [];

  for (const event of events) {
    rows.push({ name: String(event.name), once: "once" in event && event.once === true, file: await fileOf(event, imports) });
  }

  return rows;
}

/**
 * Rôle d'une migration : sa première ligne de commentaire, sinon les tables qu'elle crée
 * ou modifie (les premières migrations n'ont pas de commentaire d'en-tête).
 */
export function summarize(sql: string): string {
  // Seul un commentaire d'en-tête (avant toute instruction) décrit la migration entière.
  const header = sql.split("\n").find((line) => line.trim() !== "" && !line.startsWith("-- ") && line.trim() !== "--") ?? "";
  const lead = sql.split("\n").slice(0, sql.split("\n").indexOf(header));
  const comment = lead.find((line) => line.startsWith("-- ") && line.trim().length > 3);

  if (comment) {
    return comment.replace(/^--\s*/, "").trim();
  }

  const created = [...sql.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((match) => match[1]!);
  const altered = [...new Set([...sql.matchAll(/ALTER TABLE (\w+) ADD/g)].map((match) => match[1]!))];

  return [created.length ? `Crée ${created.join(", ")}` : "", altered.length ? `modifie ${altered.join(", ")}` : ""]
    .filter(Boolean)
    .join(" ; ");
}

async function collectDatabase(): Promise<Pick<Inventory, "migrations" | "tables" | "functions">> {
  const client = new PGlite();

  try {
    await applyMigrations(client);

    const tables = await client.query<{ name: string; rls: boolean }>(
      `SELECT c.relname AS name, c.relrowsecurity AS rls
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY c.relname`,
    );
    const columns = await client.query<{ table: string; name: string; type: string; nullable: string; pk: boolean }>(
      `SELECT c.table_name AS "table", c.column_name AS name, c.data_type AS type, c.is_nullable AS nullable,
              EXISTS (
                SELECT 1 FROM pg_index i
                JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
                WHERE i.indisprimary AND i.indrelid = format('public.%I', c.table_name)::regclass AND a.attname = c.column_name
              ) AS pk
       FROM information_schema.columns c WHERE c.table_schema = 'public' ORDER BY c.table_name, c.ordinal_position`,
    );
    const functions = await client.query<{ name: string; args: string; secdef: boolean }>(
      `SELECT p.proname AS name, pg_get_function_arguments(p.oid) AS args, p.prosecdef AS secdef
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' ORDER BY p.proname`,
    );
    const migrations = (await readMigrations()).map((file) => ({ name: file.name, summary: summarize(file.content) }));

    return {
      migrations,
      tables: tables.rows.map((table) => ({
        name: table.name,
        rls: table.rls,
        columns: columns.rows
          .filter((column) => column.table === table.name)
          .map((column) => ({ name: column.name, type: column.type, nullable: column.nullable === "YES", primaryKey: column.pk })),
      })),
      functions: functions.rows.map((fn) => ({ name: fn.name, args: fn.args, securityDefiner: fn.secdef })),
    };
  } finally {
    await client.close();
  }
}

async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => (entry.isDirectory() ? walk(join(directory, entry.name)) : [join(directory, entry.name)])));
  return nested.flat();
}

async function collectPanel(): Promise<Pick<Inventory, "routes" | "features">> {
  const appDir = join(path.panelSrc, "app");
  const pages = (await walk(appDir)).filter((file) => /\/(page|route)\.tsx?$/.test(file.split(sep).join("/"))).sort();
  const routes = pages.map((file) => {
    const segments = rel(file).replace(/^apps\/panel\/src\/app\//, "").split("/").slice(0, -1).filter((segment) => !/^\(.*\)$/.test(segment));
    return { route: `/${segments.join("/")}`, file: rel(file) };
  });

  // Dynamique : `features.ts` est du TypeScript pur, mais son alias `@/` est celui du panneau.
  const { FEATURES } = (await import(join(path.panelSrc, "lib/features.ts"))) as {
    FEATURES: Record<string, { wired: boolean; needs: string }>;
  };

  return {
    routes,
    features: Object.entries(FEATURES).map(([key, value]) => ({ key, wired: value.wired, needs: value.needs })),
  };
}

/** Variables d'un `.env.example` avec le commentaire qui les précède. */
export function parseEnvExample(text: string): EnvRow[] {
  const rows: EnvRow[] = [];
  let comment: string[] = [];

  for (const line of text.split("\n")) {
    const trimmed = line.trim();

    if (trimmed.startsWith("#")) {
      comment.push(trimmed.replace(/^#\s?/, ""));
    } else if (/^[A-Z][A-Z0-9_]*=/.test(trimmed)) {
      const [name, ...rest] = trimmed.split("=");
      rows.push({ name: name!, example: rest.join("="), description: comment.join(" ") });
      comment = [];
    } else {
      comment = [];
    }
  }

  return rows;
}

async function collectEnv(): Promise<Record<string, readonly EnvRow[]>> {
  const read = async (file: string) => parseEnvExample(await readFile(file, "utf8"));
  return {
    "apps/bot/.env.example": await read(join(path.bot, ".env.example")),
    "apps/panel/.env.example": await read(join(path.panel, ".env.example")),
  };
}

async function collectScripts(): Promise<ScriptRow[]> {
  const pkg = JSON.parse(await readFile(join(ROOT, "package.json"), "utf8")) as { scripts: Record<string, string> };
  return Object.entries(pkg.scripts).map(([name, command]) => ({ name, command }));
}

export async function collectInventory(): Promise<Inventory> {
  const [commands, eventRows, database, panel, env, scripts] = await Promise.all([
    collectCommands(), collectEvents(), collectDatabase(), collectPanel(), collectEnv(), collectScripts(),
  ]);

  return { commands, events: eventRows, ...database, ...panel, env, scripts };
}

#!/usr/bin/env bun
/**
 * `bun run doctor` : diagnostic de l'environnement de développement, avec le remède pour chaque problème.
 * `--online` teste aussi la connexion à la base et la validité du jeton Discord (réseau).
 */
import { existsSync } from "node:fs";
import { createConnection } from "node:net";
import { join } from "node:path";

import { readAppConfig } from "../packages/config/src/index.ts";
import { flag, parseArgs } from "./lib/args.ts";
import { mask, maskUrl, readDotenv } from "./lib/dotenv.ts";
import { path } from "./lib/paths.ts";
import { fail, ok, term, warn } from "./lib/term.ts";

type Level = "ok" | "warn" | "fail";
type Finding = Readonly<{ level: Level; text: string; fix?: string }>;

const findings: Finding[] = [];
const add = (level: Level, text: string, fix?: string) => findings.push({ level, text, fix });

const inUse = (port: number) =>
  new Promise<boolean>((resolve) => {
    const socket = createConnection({ port, host: "127.0.0.1" });
    socket.once("connect", () => (socket.destroy(), resolve(true)));
    socket.once("error", () => resolve(false));
  });

async function checkToolchain() {
  const [major, minor] = Bun.version.split(".").map(Number) as [number, number];
  major > 1 || minor >= 1 ? add("ok", `Bun ${Bun.version}`) : add("fail", `Bun ${Bun.version} trop ancien`, "Mettez Bun à jour : bun upgrade");

  existsSync(join(path.root, "node_modules")) && existsSync(join(path.panel, "node_modules"))
    ? add("ok", "Dépendances installées")
    : add("fail", "Dépendances absentes", "bun install (à la racine)");

  existsSync(join(path.root, "packages/native/dist/sakutina_native.node"))
    ? add("ok", "Addon natif compilé (/me card disponible)")
    : add("warn", "Addon natif non compilé : /me card sera désactivée", Bun.which("cargo") ? "bun run native:build" : "Installer Rust (https://rustup.rs) puis bun run native:build");
}

async function checkBot(online: boolean) {
  const env = await readDotenv(join(path.bot, ".env"));

  if (!env) {
    add("warn", "apps/bot/.env absent : le bot ne démarrera pas", "cp apps/bot/.env.example apps/bot/.env puis renseigner DISCORD_TOKEN");
    return;
  }

  try {
    const config = readAppConfig(env as NodeJS.ProcessEnv);
    add("ok", `Configuration du bot valide (multi-serveur, environnement ${config.environment})`);

    config.databaseUrl
      ? add("ok", `DATABASE_URL : ${maskUrl(config.databaseUrl)}`)
      : add("warn", "DATABASE_URL absent : stockage en mémoire, données perdues au redémarrage (normal en local)");
    config.trackPresence && add("warn", "TRACK_PRESENCE=true : l'intention privilégiée « Presence » doit être activée dans le portail développeur Discord, sinon la connexion est refusée");

    if (online) {
      await checkDiscord(config.discordToken);
      if (config.databaseUrl) await checkDatabase(config.databaseUrl);
    } else {
      add("ok", `DISCORD_TOKEN : ${mask(config.discordToken)} (non testé ; --online pour le vérifier)`);
    }
  } catch (error) {
    add("fail", `Configuration du bot invalide : ${error instanceof Error ? error.message : String(error)}`, "Corriger apps/bot/.env (modèle : apps/bot/.env.example)");
  }
}

async function checkDiscord(token: string) {
  const response = await fetch("https://discord.com/api/v10/users/@me", { headers: { authorization: `Bot ${token}` }, signal: AbortSignal.timeout(8_000) }).catch(() => null);

  if (!response) add("warn", "Discord injoignable (réseau ?)");
  else if (response.ok) add("ok", `Jeton Discord valide (bot « ${((await response.json()) as { username: string }).username} »)`);
  else add("fail", `Jeton Discord refusé (HTTP ${response.status})`, "Régénérer le jeton dans le portail développeur Discord (Bot > Reset Token)");
}

async function checkDatabase(url: string) {
  try {
    // `postgres` est une dépendance du bot, pas des outils : on la résout depuis le bot.
    const { default: postgres } = (await import(Bun.resolveSync("postgres", path.bot))) as { default: (url: string, options: object) => { (query: TemplateStringsArray): Promise<unknown[]>; end: () => Promise<void> } };
    const sql = postgres(url, { max: 1, connect_timeout: 8 });
    await sql`select 1`;
    await sql.end();
    add("ok", "Base de données joignable");
  } catch (error) {
    add("fail", `Base de données injoignable : ${error instanceof Error ? error.message : String(error)}`, "Vérifier DATABASE_URL ; un projet Supabase gratuit s'endort après une semaine d'inactivité (le réveiller depuis le tableau de bord)");
  }
}

async function checkPanel() {
  const env = (await readDotenv(join(path.panel, ".env.local"))) ?? (await readDotenv(join(path.panel, ".env")));
  const complete = env?.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  complete
    ? add("ok", `Panneau configuré (Supabase : ${new URL(env.NEXT_PUBLIC_SUPABASE_URL!).host})`)
    : add("warn", "Panneau sans configuration Supabase : la connexion Discord ne marchera pas", "Pour développer sans Supabase : bun run dev:local — ou copier apps/panel/.env.example vers apps/panel/.env.local");
}

async function checkPorts() {
  for (const [port, role] of [[3000, "bot (health) ou panneau"], [3999, "faux bot de dev:local"], [54321, "faux Supabase de dev:local"]] as const) {
    (await inUse(port)) && add("warn", `Port ${port} déjà utilisé (${role})`, "Arrêter le processus qui l'occupe, ou choisir un autre port (dev:local --port / --bot-port / --panel-port)");
  }
}

const args = parseArgs(Bun.argv.slice(2));
await checkToolchain();
await checkBot(flag(args, "online"));
await checkPanel();
await checkPorts();

for (const finding of findings) {
  const line = finding.level === "ok" ? ok(finding.text) : finding.level === "warn" ? warn(finding.text) : fail(finding.text);
  console.log(line);
  if (finding.fix && finding.level !== "ok") console.log(`  ${term.dim("→")} ${finding.fix}`);
}

const failures = findings.filter((finding) => finding.level === "fail").length;
const warnings = findings.filter((finding) => finding.level === "warn").length;
console.log(`\n${failures ? fail(`${failures} problème(s) bloquant(s)`) : ok("Rien de bloquant")}${warnings ? term.dim(` — ${warnings} avertissement(s)`) : ""}`);
process.exitCode = failures ? 1 : 0;

#!/usr/bin/env bun
/**
 * `bun run dev:local` : le panneau complet en local, sans Discord, sans Supabase, sans compte.
 *
 *   bun run dev:local                 panneau (3000) + faux Supabase (54321) + faux bot (3999)
 *   bun run dev:local --no-panel      seulement le faux Supabase et le faux bot (le panneau tourne ailleurs)
 *   bun run dev:local --panel-port 3100 --port 54400 --bot-port 3998
 *   Faux bot « Discord déconnecté » : http://localhost:3999/api/v1/health?state=degraded
 */
import { flag, parseArgs, stringOption } from "../lib/args.ts";
import { path } from "../lib/paths.ts";
import { ok, term } from "../lib/term.ts";
import { startBotMock } from "./bot-mock.ts";
import { startDevSupabase } from "./supabase.ts";

const args = parseArgs(Bun.argv.slice(2));
const supabasePort = Number(stringOption(args, "port") ?? 54321);
const botPort = Number(stringOption(args, "bot-port") ?? 3999);
const panelPort = Number(stringOption(args, "panel-port") ?? 3000);
// `localhost` (pas 127.0.0.1) : le cookie de session posé par le faux Supabase doit être lu par le panneau.
const panelUrl = `http://localhost:${panelPort}`;
const guildId = Bun.env.DISCORD_PRIMARY_GUILD_ID ?? "1317931106993180763";

const supabase = await startDevSupabase({ port: supabasePort, panelUrl, guildId });
const bot = startBotMock(botPort);
let panel: ReturnType<typeof Bun.spawn> | null = null;

console.log(ok(`Faux Supabase (vraies migrations sur PGlite, données de démonstration) : ${supabase.url}`));
console.log(ok(`Faux bot : http://localhost:${bot.port}/api/v1/health`));

if (!flag(args, "no-panel")) {
  panel = Bun.spawn(["bun", "run", "dev", "-p", String(panelPort)], {
    cwd: path.panel,
    stdout: "inherit",
    stderr: "inherit",
    env: {
      ...Bun.env,
      NEXT_PUBLIC_SUPABASE_URL: supabase.url,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "dev-local",
      BOT_API_URL: `http://localhost:${bot.port}`,
      DISCORD_PRIMARY_GUILD_ID: guildId,
    },
  });
}

console.log(`\n${term.bold("Se connecter au panneau :")} ${supabase.url}/__dev   (Mika = propriétaire, Aiko = admin, Visiteur = refusé)`);
console.log(term.dim(`Env du panneau à utiliser si vous le lancez vous-même : NEXT_PUBLIC_SUPABASE_URL=${supabase.url} NEXT_PUBLIC_SUPABASE_ANON_KEY=dev-local BOT_API_URL=http://localhost:${bot.port}`));
console.log(term.dim("Ctrl+C pour arrêter.\n"));

const stop = async () => {
  panel?.kill();
  bot.close();
  await supabase.close();
  process.exit(0);
};

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
await new Promise(() => {});

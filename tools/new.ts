#!/usr/bin/env bun
/**
 * `bun run new <type> …` : génère le code d'une nouveauté en respectant les conventions du dépôt
 * (fichier, enregistrement, textes, tests, inventaire), puis vérifie le résultat.
 */
import { parseArgs, flag, stringOption, type ParsedArgs } from "./lib/args.ts";
import { path } from "./lib/paths.ts";
import type { Generated } from "./lib/generator.ts";
import { fail, ok, term } from "./lib/term.ts";
import { runCheck } from "./lib/plan.ts";

const HELP = `Usage : bun run new <type> <arguments> [options]

  command <section> <nom> [--role member|moderator|admin|owner] [--description "…"] [--title "…"] [--dir dossier] [--public]
      Sous-commande Discord : fichier, enregistrement dans la section, textes (messages.ts), test, test du registre.
      Ex. : bun run new command economy shop --role member --description "Voir la boutique"

  event <Evénement> [--once]
      Événement Discord : fichier, enregistrement, test. Ex. : bun run new event GuildBanAdd

  migration <nom> [--table <table>]
      Migration SQL numérotée. Avec --table : table + RLS + définition Drizzle alignée.
      Ex. : bun run new migration shop_items --table shop_item

  panel-fn <nom> [--summary "…"]
      Fonction SQL panel_<nom> sécurisée (réservée aux admins) + test base + lecteur et validation côté panneau.
      Ex. : bun run new panel-fn economy_summary

Options communes : --dry-run (montre sans écrire)  --no-verify (pas de vérification)  --no-inventory`;

async function build(kind: string, args: ParsedArgs): Promise<Generated> {
  const [first, second] = args.positional;

  switch (kind) {
    case "command": {
      if (!first || !second) throw new Error("Usage : bun run new command <section> <nom>");
      const { planCommand } = await import("./generators/command.ts");
      return planCommand({
        group: first,
        name: second,
        role: stringOption(args, "role") ?? "member",
        dir: stringOption(args, "dir"),
        description: stringOption(args, "description"),
        title: stringOption(args, "title"),
        isPublic: flag(args, "public"),
      });
    }
    case "event": {
      if (!first) throw new Error("Usage : bun run new event <Événement discord.js>");
      const { planEvent } = await import("./generators/event.ts");
      // discord.js n'est pas une dépendance des outils : on le résout depuis le bot.
      const discord = (await import(Bun.resolveSync("discord.js", path.bot))) as { Events: Record<string, string> };
      return planEvent({ event: first, once: flag(args, "once"), events: discord.Events });
    }
    case "migration": {
      if (!first) throw new Error("Usage : bun run new migration <nom> [--table <table>]");
      const { planMigration } = await import("./generators/migration.ts");
      return planMigration({ name: first, table: stringOption(args, "table") });
    }
    case "panel-fn": {
      if (!first) throw new Error("Usage : bun run new panel-fn <nom>");
      const { planPanelFunction } = await import("./generators/panel-fn.ts");
      return planPanelFunction({ name: first, summary: stringOption(args, "summary") });
    }
    default:
      throw new Error(`Type « ${kind} » inconnu.\n\n${HELP}`);
  }
}

async function main() {
  const args = parseArgs(Bun.argv.slice(2));
  const [kind, ...rest] = args.positional;

  if (!kind || flag(args, "help")) {
    console.log(HELP);
    return;
  }

  const dryRun = flag(args, "dry-run");
  const generated = await build(kind, { ...args, positional: rest });

  await generated.plan.apply({ dryRun });

  if (dryRun) {
    console.log(term.dim("\nSimulation : rien n'a été écrit."));
    return;
  }

  let healthy = true;

  if (!flag(args, "no-inventory")) {
    healthy = (await runCheck("docs/inventory.md régénéré", ["bun", "tools/inventory.ts"], path.root)) && healthy;
  }

  if (!flag(args, "no-verify")) {
    for (const check of generated.checks) {
      healthy = (await runCheck(check.label, check.command, check.cwd)) && healthy;
    }
  }

  console.log(`\n${healthy ? ok("Généré et vérifié.") : fail("Généré, mais une vérification a échoué (voir ci-dessus).")}\n\nÀ faire à la main :`);
  for (const step of generated.next) console.log(`  - ${step}`);

  process.exitCode = healthy ? 0 : 1;
}

try {
  await main();
} catch (error) {
  console.error(fail(error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
}

import { join } from "node:path";

import { appendToArray, insertImport } from "../lib/edit.ts";
import type { Generated } from "../lib/generator.ts";
import { camel, kebab } from "../lib/names.ts";
import { path, type Paths } from "../lib/paths.ts";
import { Plan } from "../lib/plan.ts";

export type EventOptions = Readonly<{ event: string; once: boolean; events: Readonly<Record<string, string>> }>;

/** Accepte `GuildBanAdd` (clé de `Events`) ou `guildBanAdd` (valeur). */
export function resolveEvent(input: string, events: Readonly<Record<string, string>>): { key: string; value: string } | null {
  const entry = Object.entries(events).find(([key, value]) => key === input || value === input || key.toLowerCase() === input.toLowerCase());
  return entry ? { key: entry[0], value: entry[1] } : null;
}

export function eventSource(o: { key: string; id: string; once: boolean }): string {
  return `import { Events } from "discord.js";

import { defineEvent } from "@/discord/events/types.ts";

export const ${o.id} = defineEvent({
  name: Events.${o.key},${o.once ? "\n  once: true," : ""}
  async execute(context, ..._args) {
    // À écrire. Rappels : le bot est mono-serveur (ignorer ce qui ne vient pas de
    // \`context.config.primaryGuildId\`) et ne conserve jamais le contenu d'un message.
    // Si l'événement exige un intent, l'ajouter dans discord/client.ts.
  },
});
`;
}

export function eventTestSource(o: { id: string; file: string }): string {
  return `import { expect, test } from "bun:test";

import { events } from "@/discord/events/index.ts";
import { ${o.id} } from "@/discord/events/${o.file}.ts";

test("${o.id} est enregistré dans la liste des événements", () => {
  expect(events).toContain(${o.id});
});
`;
}

export function planEvent(o: EventOptions, paths: Paths = path): Generated {
  const resolved = resolveEvent(o.event, o.events);

  if (!resolved) {
    throw new Error(`Événement « ${o.event} » inconnu de discord.js. Exemples : ${Object.keys(o.events).slice(0, 8).join(", ")}…`);
  }

  const id = camel(resolved.value);
  const file = kebab(resolved.value);
  const target = join(paths.botSrc, "discord/events", `${file}.ts`);

  const plan = new Plan()
    .create(target, eventSource({ key: resolved.key, id, once: o.once }))
    .create(join(paths.botTest, "discord/events", `${file}.test.ts`), eventTestSource({ id, file }))
    .edit(join(paths.botSrc, "discord/events/index.ts"), "liste des événements", (source) => {
      const withImport = insertImport(source, `import { ${id} } from "@/discord/events/${file}.ts";`, "@/discord/events/", "événements");
      return appendToArray(withImport, /export const events = /, id, "événements");
    });

  return {
    plan,
    checks: [
      { label: "types du bot", command: ["bun", "run", "check"], cwd: paths.bot },
      { label: "tests des événements", command: ["bun", "test", "test/discord/events", "test/architecture.test.ts"], cwd: paths.bot },
    ],
    next: [`Écrire le handler dans apps/bot/src/discord/events/${file}.ts et ajouter l'intent nécessaire dans discord/client.ts.`],
  };
}

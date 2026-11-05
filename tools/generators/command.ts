import { join } from "node:path";

import { groups } from "../../apps/bot/src/discord/commands/index.ts";
import { ROLES } from "../../apps/bot/src/domain/permissions/permissions.ts";
import { EditError, appendToArray, insertImport, insertInBlock, replaceOnce } from "../lib/edit.ts";
import type { Generated } from "../lib/generator.ts";
import { camel, isDiscordName, kebab } from "../lib/names.ts";
import { path, type Paths } from "../lib/paths.ts";
import { Plan } from "../lib/plan.ts";

/** Dossier de `discord/commands/` rangeant chaque section (les sections ne suivent pas toujours les dossiers). */
const GROUP_DIR: Record<string, string> = { economy: "economy", me: "tracking", info: "general", server: "general", mod: "moderation", phaethon: "phaethon" };
/** Clé de `messages.ts` des textes de chaque dossier. */
const DIR_MESSAGES: Record<string, string> = { general: "general", economy: "economy", tracking: "tracking", moderation: "moderation", phaethon: "phaethon", administration: "admin", profile: "card" };
/** Catégorie d'UI (couleur d'accent) de chaque dossier. */
const DIR_CATEGORY: Record<string, string> = { general: "general", economy: "economy", tracking: "tracking", profile: "profile" };

export type CommandOptions = Readonly<{
  group: string;
  name: string;
  role: string;
  dir?: string;
  description?: string;
  title?: string;
  /** Réponse visible de tous (par défaut : privée, comme la plupart des commandes). */
  isPublic: boolean;
}>;

const titleCase = (value: string) => value.replace(/[-_]+/g, " ").replace(/^./, (c) => c.toUpperCase());
const str = (value: string) => JSON.stringify(value);

export function commandSource(o: { name: string; id: string; key: string; role: string; category: string; isPublic: boolean }): string {
  const reply = o.isPublic ? "respond" : "respondPrivately";

  return `import { SlashCommandSubcommandBuilder } from "discord.js";

import type { Command } from "@/discord/commands/command.ts";
import { messages } from "@/discord/messages.ts";
import { createPanel } from "@/discord/ui/panels.ts";
import { ${reply} } from "@/discord/ui/replies.ts";

export const ${o.id}Command: Command = {
  definition: new SlashCommandSubcommandBuilder()
    .setName(${str(o.name)})
    .setDescription(messages.${o.key}.${o.id}.description)
    .toJSON(),
  requiredRole: ${str(o.role)},
  async execute(interaction) {
    const text = messages.${o.key}.${o.id};

    await ${reply}(
      interaction,
      createPanel({
        category: ${str(o.category)},
        title: text.title,
        description: text.body,
      }),
    );
  },
};
`;
}

export function commandTestSource(o: { group: string; name: string; id: string; key: string; dir: string; role: string; isPublic: boolean }): string {
  return `import { expect, test } from "bun:test";

import { ${o.id}Command } from "@/discord/commands/${o.dir}/${kebab(o.name)}.ts";
import { findCommand } from "@/discord/commands/index.ts";
import { messages } from "@/discord/messages.ts";
import { commandInteraction, createContext, isEphemeral } from "../../../support/fakes.ts";
import { textOf } from "../../../support/panel-text.ts";

test("/${o.group} ${o.name} est enregistrée avec le rôle voulu", () => {
  expect(findCommand(${str(o.group)}, ${str(o.name)})).toBe(${o.id}Command);
  expect(${o.id}Command.requiredRole).toBe(${str(o.role)});
});

test("/${o.group} ${o.name} répond d'un seul panneau", async () => {
  const { context } = createContext();
  const command = commandInteraction({});

  await ${o.id}Command.execute(command.fake, context, { role: ${str(o.role)} });

  expect(command.replies).toHaveLength(1);
  expect(textOf(command.replies[0])).toContain(messages.${o.key}.${o.id}.title);
  expect(isEphemeral(command.replies[0])).toBe(${!o.isPublic});
});
`;
}

export function planCommand(o: CommandOptions, paths: Paths = path): Generated {
  const group = groups.find((g) => g.name === o.group);

  if (!group) {
    throw new Error(`Section « ${o.group} » inconnue. Sections : ${groups.map((g) => g.name).join(", ")}. (Une nouvelle section se déclare à la main dans discord/commands/index.ts.)`);
  }
  if (!isDiscordName(o.name)) {
    throw new Error(`Nom « ${o.name} » invalide : minuscules, chiffres, - et _ (1 à 32 caractères).`);
  }
  if (group.commands.some((command) => command.definition.name === o.name)) {
    throw new Error(`/${o.group} ${o.name} existe déjà.`);
  }
  if (!(ROLES as readonly string[]).includes(o.role)) {
    throw new Error(`Rôle « ${o.role} » inconnu. Rôles : ${ROLES.join(", ")}.`);
  }

  const dir = o.dir ?? GROUP_DIR[o.group];
  if (!dir) throw new Error(`Pas de dossier connu pour la section « ${o.group} » : précisez --dir.`);

  const id = camel(o.name);
  const key = DIR_MESSAGES[dir] ?? camel(dir);
  const category = DIR_CATEGORY[dir] ?? "admin";
  const description = o.description ?? "À compléter";
  const file = join(paths.botSrc, "discord/commands", dir, `${kebab(o.name)}.ts`);
  const testFile = join(paths.botTest, "discord/commands", dir, `${kebab(o.name)}.test.ts`);

  if (description.length > 100) throw new Error("La description d'une commande Discord est limitée à 100 caractères.");

  const messageBlock = `    ${id}: {\n      description: ${str(description)},\n      title: ${str(o.title ?? titleCase(o.name))},\n      body: "À compléter.",\n    },`;

  const plan = new Plan()
    .create(file, commandSource({ name: o.name, id, key, role: o.role, category, isPublic: o.isPublic }))
    .create(testFile, commandTestSource({ group: o.group, name: o.name, id, key, dir, role: o.role, isPublic: o.isPublic }))
    .edit(join(paths.botSrc, "discord/commands/index.ts"), "registre des commandes", (source) => {
      const withImport = insertImport(source, `import { ${id}Command } from "@/discord/commands/${dir}/${kebab(o.name)}.ts";`, "@/discord/commands/", "registre");
      return appendToArray(withImport, new RegExp(`name:\\s*"${o.group}",[\\s\\S]*?commands:\\s*`), `${id}Command`, "registre");
    })
    .edit(join(paths.botSrc, "discord/messages.ts"), "textes (messages.ts)", (source) =>
      new RegExp(`\\n  ${key}: \\{`).test(source)
        ? insertInBlock(source, new RegExp(`\\n  ${key}: \\{`), messageBlock, "messages.ts")
        : replaceOnce(source, /\n\} as const;\s*$/, `\n  ${key}: {\n${messageBlock}\n  },\n} as const;\n`, "messages.ts"),
    )
    .edit(join(paths.botTest, "discord/commands/registry.test.ts"), "test du registre", (source) => {
      const withList = replaceOnce(source, new RegExp(`(\\["${o.group}", \\[[^\\]]*)(\\]\\])`), (_m, head, tail) => `${head}, ${str(o.name)}${tail}`, "liste des commandes du test");
      // Le nombre se lit dans le fichier (et non dans le registre en mémoire) : deux générations de suite restent cohérentes.
      const count = Number(/expect\(commands\)\.toHaveLength\((\d+)\)/.exec(withList)?.[1]);

      if (!Number.isInteger(count)) throw new EditError("test du registre : `expect(commands).toHaveLength(N)` introuvable");

      return replaceOnce(withList.replace(/au lieu de \d+/, `au lieu de ${count + 1}`), `expect(commands).toHaveLength(${count})`, `expect(commands).toHaveLength(${count + 1})`, "nombre de commandes du test");
    });

  return {
    plan,
    checks: [
      { label: "types du bot", command: ["bun", "run", "check"], cwd: paths.bot },
      { label: "tests des commandes", command: ["bun", "test", "test/discord", "test/architecture.test.ts"], cwd: paths.bot },
    ],
    next: [
      `Écrire le comportement dans ${file.replace(`${paths.root}`, "").replace(/^\//, "")} (options : .addStringOption(...) sur le SlashCommandSubcommandBuilder).`,
      "Mettre à jour les nombres de commandes cités dans README.md (tableau) et Tasks.md si vous les maintenez.",
      "Republier les commandes sur Discord : bun run commands:register (remplace les anciennes ; à faire une fois le code déployé).",
    ],
  };
}

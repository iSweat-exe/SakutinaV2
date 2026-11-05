import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "bun:test";

const srcDirectory = fileURLToPath(new URL("../src/", import.meta.url));

function sourceFiles(folder: string): string[] {
  const root = join(srcDirectory, folder);

  const walk = (directory: string): string[] =>
    readdirSync(directory).flatMap((name) => {
      const path = join(directory, name);

      return statSync(path).isDirectory() ? walk(path) : [path];
    });

  return walk(root).filter((path) => path.endsWith(".ts"));
}

function importsOf(path: string): string[] {
  const source = readFileSync(path, "utf8");

  return [...source.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map(
    (match) => match[1]!,
  );
}

/** Dépendances interdites par dossier : la règle de dépendance de `docs/architecture.md`. */
const forbidden: Record<string, readonly string[]> = {
  domain: ["discord.js", "@/discord/", "@/database/", "@/http/", "@/app/", "drizzle-orm", "postgres"],
  database: ["discord.js", "@/discord/", "@/http/", "@/app/"],
  http: ["discord.js", "@/discord/", "@/database/", "@/app/"],
  discord: ["@/database/", "@/http/", "@/app/"],
  shared: ["discord.js", "@/discord/", "@/domain/", "@/database/", "@/http/", "@/app/"],
};

for (const [folder, banned] of Object.entries(forbidden)) {
  test(`${folder}/ n'importe aucune couche interdite`, () => {
    const files = sourceFiles(folder);
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      for (const specifier of importsOf(file)) {
        const hit = banned.find(
          (prefix) => specifier === prefix || specifier.startsWith(prefix),
        );

        expect(hit, `${file} importe « ${specifier} »`).toBeUndefined();
      }
    }
  });
}

test("toutes les réponses Discord passent par discord/ui (embeds uniquement)", () => {
  const replyCalls = /\.(reply|followUp|editReply|update|deferUpdate)\s*\(/;
  const rawContent = /\bcontent\s*:/;
  const files = sourceFiles("discord").filter(
    (file) => !file.replaceAll("\\", "/").endsWith("discord/ui/replies.ts"),
  );

  for (const file of files) {
    const source = readFileSync(file, "utf8");

    expect(replyCalls.test(source), `${file} répond sans passer par ui/replies.ts`).toBe(false);

    // Le constructeur de panneaux (ui/) manipule du texte ; les commandes n'en envoient jamais en brut.
    if (!file.replaceAll("\\", "/").includes("discord/ui/")) {
      expect(rawContent.test(source), `${file} envoie du texte brut (« content: »)`).toBe(false);
    }
  }
});

test("aucune commande ne choisit sa propre couleur d'embed", () => {
  const files = sourceFiles("discord").filter(
    (file) => !file.replaceAll("\\", "/").includes("discord/ui/"),
  );

  for (const file of files) {
    expect(readFileSync(file, "utf8"), `${file} fixe une couleur`).not.toMatch(/setColor\s*\(|\bcolor\s*:\s*0x/);
  }
});

test("aucun embed : les messages sont des composants V2 (un message V2 n'accepte ni embeds ni contenu)", () => {
  for (const file of sourceFiles("discord")) {
    expect(readFileSync(file, "utf8"), `${file} utilise un embed`).not.toMatch(/EmbedBuilder|embeds\s*:/);
  }
});

test("chaque identifiant de composant passe par encodeId", () => {
  const files = sourceFiles("discord").filter(
    (file) => !file.replaceAll("\\", "/").endsWith("components/custom-id.ts"),
  );

  for (const file of files) {
    expect(readFileSync(file, "utf8"), `${file} fabrique un identifiant de routage à la main`).not.toMatch(/setCustomId\(\s*["'`][^"'`]*:/);
  }
});

test("aucun pictogramme décoratif : seules les médailles du podium sont des emojis", () => {
  const allowed = new Set(["discord/ui/theme.ts", "discord/ui/blocks.ts"]);

  for (const file of sourceFiles("discord")) {
    const normalized = file.replaceAll("\\", "/");

    if ([...allowed].some((suffix) => normalized.endsWith(suffix))) {
      continue;
    }

    expect(readFileSync(file, "utf8"), `${file} contient un emoji`).not.toMatch(/\p{Extended_Pictographic}/u);
  }
});

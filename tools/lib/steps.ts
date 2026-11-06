import { join } from "node:path";
import { path } from "./paths.ts";

export type Area = "bot" | "panel" | "tools";

export type Step = Readonly<{
  id: string;
  /** Ce que la commande vérifie, en une phrase (affiché par `--list`). */
  description: string;
  cwd: string;
  command: readonly string[];
  /** Dossiers dont la modification rend cette étape pertinente pour `--changed`. */
  areas: readonly Area[];
  /** Réservé à `--full` (lent). */
  full?: boolean;
  env?: Readonly<Record<string, string>>;
}>;

/** Variables factices : le build du panneau les exige, aucune n'est contactée. */
const PANEL_BUILD_ENV = {
  // Bun donne `NODE_ENV=development` par défaut à ses processus : un build de production doit vraiment être en production,
  // sinon React mélange ses versions de développement et de production (« Cannot read properties of null »).
  NODE_ENV: "production",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "build-only",
};

/**
 * Tout ce que la CI vérifie (`.github/workflows/ci.yml`), plus le contrôle de
 * l'inventaire. Ajouter une vérification = une ligne ici.
 */
export const STEPS: readonly Step[] = [
  { id: "bot:types", description: "TypeScript du bot (tsc)", cwd: path.bot, command: ["bun", "run", "check"], areas: ["bot"] },
  { id: "bot:test", description: "Tests du bot (règles d'architecture, base PGlite, commandes)", cwd: path.bot, command: ["bun", "test"], areas: ["bot"] },
  { id: "panel:lint", description: "ESLint du panneau", cwd: path.panel, command: ["bun", "run", "lint"], areas: ["panel"] },
  {
    id: "panel:types",
    description: "TypeScript du panneau (génère d'abord les types de routes Next)",
    cwd: path.panel,
    command: ["sh", "-c", "bunx next typegen > /dev/null && bunx tsc --noEmit -p ."],
    areas: ["panel"],
  },
  { id: "panel:test", description: "Tests unitaires du panneau", cwd: path.panel, command: ["bun", "run", "test"], areas: ["panel"] },
  { id: "panel:build", description: "Build de production du panneau (webpack)", cwd: path.panel, command: ["bun", "run", "build"], areas: ["panel"], full: true, env: PANEL_BUILD_ENV },
  { id: "tools:types", description: "TypeScript des outils", cwd: join(path.root, "tools"), command: ["bun", "run", "check"], areas: ["tools"] },
  { id: "tools:test", description: "Tests des outils", cwd: join(path.root, "tools"), command: ["bun", "run", "test"], areas: ["tools"] },
  {
    id: "inventory:check",
    description: "docs/inventory.md à jour (commandes, événements, tables, fonctions panel_*)",
    cwd: path.root,
    command: ["bun", "tools/inventory.ts", "--check"],
    areas: ["bot", "panel", "tools"],
  },
];

/** Dossiers touchés par une liste de fichiers (chemins relatifs à la racine, séparés par `/`). */
export function areasOf(files: readonly string[]): ReadonlySet<Area> {
  const areas = new Set<Area>();

  for (const file of files) {
    if (file.startsWith("apps/bot/") || file.startsWith("packages/")) areas.add("bot");
    else if (file.startsWith("apps/panel/")) areas.add("panel");
    else if (file.startsWith("tools/")) areas.add("tools");
    // Dépendances, configuration TypeScript, CI : tout peut être concerné.
    else if (/^(package\.json|bun\.lock|tsconfig[^/]*\.json|\.github\/)/.test(file)) {
      areas.add("bot").add("panel").add("tools");
    }
  }

  return areas;
}

export function selectSteps(options: {
  changed?: readonly string[];
  full: boolean;
  only?: readonly string[];
}): readonly Step[] {
  const { changed, full, only } = options;
  const areas = changed ? areasOf(changed) : null;

  return STEPS.filter((step) => {
    // Un identifiant exact est explicite (même lent) ; une famille ne lance pas les étapes lentes sans --full.
    if (only) return only.includes(step.id) || (only.includes(step.id.split(":")[0]!) && (!step.full || full));
    if (step.full && !full) return false;
    return areas === null || step.areas.some((area) => areas.has(area));
  });
}

import type { Inventory } from "./inventory-data.ts";

const cell = (value: string) => value.replaceAll("|", "\\|").replaceAll("\n", " ");
const table = (head: readonly string[], rows: readonly (readonly string[])[]) =>
  [`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`, ...rows.map((row) => `| ${row.map(cell).join(" | ")} |`)].join("\n");

/** Rend l'inventaire en Markdown. Déterministe : aucune date, aucun ordre dépendant de la machine. */
export function renderInventory(data: Inventory): string {
  const parts: string[] = [];
  const section = (title: string, intro: string, body: string) => parts.push(`## ${title}\n\n${intro}\n\n${body}`);

  parts.push(
    [
      "# Inventaire du dépôt",
      "",
      "> Généré par `bun run inventory` — **ne pas modifier à la main**. `bun run verify` (et la CI) échouent si ce fichier est périmé.",
      "> Il répond à « qu'est-ce qui existe déjà ? » sans lire tout le code. Les règles et le « pourquoi » sont dans [architecture.md](./architecture.md).",
    ].join("\n"),
  );

  section(
    `Commandes Discord (${data.commands.length})`,
    "Rôle minimal par sous-commande ; `*` = option obligatoire. Ajouter : `bun run new command`.",
    table(["Commande", "Rôle", "Options", "Fichier"], data.commands.map((c) => [`\`${c.command}\``, c.role, c.options || "—", `\`${c.file}\``])),
  );

  section(
    `Événements Discord (${data.events.length})`,
    "Ajouter : `bun run new event`.",
    table(["Événement", "Une fois", "Fichier"], data.events.map((e) => [`\`${e.name}\``, e.once ? "oui" : "non", `\`${e.file}\``])),
  );

  section(
    `Migrations (${data.migrations.length})`,
    "Les migrations font foi ; le dossier `schema/` (Drizzle) doit rester aligné (un test le vérifie). Ajouter : `bun run new migration`.",
    table(["Fichier", "Rôle"], data.migrations.map((m) => [`\`${m.name}\``, m.summary || "—"])),
  );

  section(
    `Tables (${data.tables.length})`,
    "Après application de toutes les migrations. RLS activé sans politique : seules les fonctions `panel_*` et le bot y accèdent. Clé primaire en **gras**.",
    data.tables
      .map((t) => `### \`${t.name}\`${t.rls ? "" : " — RLS DÉSACTIVÉ"}\n\n${t.columns.map((c) => `- ${c.primaryKey ? `**${c.name}**` : c.name} : ${c.type}${c.nullable ? ", nullable" : ""}`).join("\n")}`)
      .join("\n\n"),
  );

  const panelFunctions = data.functions.filter((f) => f.name.startsWith("panel_"));
  section(
    `Fonctions du panneau (${panelFunctions.length})`,
    "Seule porte d'entrée du panneau vers la base. Ajouter : `bun run new panel-fn`.",
    table(["Fonction", "Arguments", "SECURITY DEFINER"], panelFunctions.map((f) => [`\`${f.name}\``, `\`${f.args}\``, f.securityDefiner ? "oui" : "NON"])),
  );

  section(
    `Pages du panneau (${data.routes.length})`,
    "Routes de `apps/panel/src/app`.",
    table(["Route", "Fichier"], data.routes.map((r) => [`\`${r.route}\``, `\`${r.file}\``])),
  );

  section(
    "Sections du panneau : branchées ou verrouillées",
    "`apps/panel/src/lib/features.ts`. Une section verrouillée affiche sa maquette derrière un cadenas.",
    table(["Fonctionnalité", "État", "Ce qui manque"], data.features.map((f) => [`\`${f.key}\``, f.wired ? "branchée" : "verrouillée", f.wired ? "—" : f.needs])),
  );

  section(
    "Variables d'environnement",
    "Valeurs d'exemple uniquement ; les vraies valeurs ne sont jamais dans le dépôt.",
    Object.entries(data.env)
      .map(([file, rows]) => `### \`${file}\`\n\n${table(["Variable", "Exemple", "Rôle"], rows.map((r) => [`\`${r.name}\``, r.example ? `\`${r.example}\`` : "—", r.description || "—"]))}`)
      .join("\n\n"),
  );

  section(
    "Scripts (racine)",
    "`bun run <nom>`. Détail des outils : [dev-tools.md](./dev-tools.md).",
    table(["Script", "Commande"], data.scripts.map((s) => [`\`${s.name}\``, `\`${s.command}\``])),
  );

  return `${parts.join("\n\n")}\n`;
}

import { expect, test } from "bun:test";
import { MessageFlags } from "discord.js";

import { bullets, codeBlock, keyValue, label, ranking, stat, statLine } from "@/discord/ui/blocks.ts";
import { button, buttonRow, selectRow } from "@/discord/ui/controls.ts";
import {
  TEXT_BUDGET,
  clamp,
  createPanel,
  errorPanel,
  infoPanel,
  renderFields,
  successPanel,
  warningPanel,
} from "@/discord/ui/panels.ts";
import { BOT_NAME, categories, palette } from "@/discord/ui/theme.ts";
import { ComponentTypes, nodesOf, textOf } from "../../support/panel-text.ts";

const container = (panel: ReturnType<typeof createPanel>) => nodesOf(panel)[0]!;

test("un panneau est un message V2 : un seul Container, le drapeau IsComponentsV2, ni contenu ni embeds", () => {
  const panel = createPanel({ category: "general", title: "Titre" });

  expect(panel.flags).toBe(MessageFlags.IsComponentsV2);
  expect(panel.components).toHaveLength(1);
  expect(container(panel).type).toBe(ComponentTypes.container);
  expect(panel).not.toHaveProperty("content");
  expect(panel).not.toHaveProperty("embeds");
});

test("chaque catégorie a sa couleur d'accent et son pied de page « Sakutina · Catégorie »", () => {
  for (const [name, category] of Object.entries(categories)) {
    const panel = createPanel({ category: name as keyof typeof categories, title: "Titre" });

    expect(container(panel).accent_color).toBe(category.color);
    expect(textOf(panel)).toContain(`-# ${BOT_NAME} · ${category.label}`);
  }
});

test("les tons remplacent la couleur de la catégorie, sans pictogramme", () => {
  const cases = [
    [successPanel, palette.success],
    [warningPanel, palette.warning],
    [errorPanel, palette.danger],
    [infoPanel, palette.info],
  ] as const;

  for (const [build, color] of cases) {
    const panel = build({ category: "economy", title: "Titre" });

    expect(container(panel).accent_color).toBe(color);
    expect(textOf(panel)).toContain("## Titre");
    expect(textOf(panel)).toContain("Économie");
  }
});

test("l'en-tête porte le sur-titre, le titre, la description et la vignette (Section)", () => {
  const panel = createPanel({
    category: "tracking",
    title: "Activité",
    description: "Résumé",
    author: { name: "iSweat" },
    thumbnail: "https://cdn.test/a.png",
  });
  const nodes = nodesOf(panel);

  expect(nodes.some((node) => node.type === ComponentTypes.section)).toBe(true);
  expect(nodes.some((node) => node.type === ComponentTypes.thumbnail)).toBe(true);
  expect(textOf(panel)).toContain("-# iSweat\n## Activité\nRésumé");
});

test("sans vignette explicite, l'en-tête est un simple texte : le nom de l'auteur n'ajoute pas d'image", () => {
  const nodes = nodesOf(createPanel({ category: "general", title: "t", author: { name: "Moi" } }));

  expect(nodes.some((node) => node.type === ComponentTypes.section)).toBe(false);
});

test("les champs s'empilent : libellé en petites capitales, puis valeur, dans un seul bloc", () => {
  expect(
    renderFields([
      { name: "Portefeuille", value: "**10 pièces**" },
      { name: "Écriture", value: "**1** messages  ·  **4** caractères" },
    ]),
  ).toEqual(["-# PORTEFEUILLE\n**10 pièces**\n\n-# ÉCRITURE\n**1** messages  ·  **4** caractères"]);

  expect(renderFields([])).toEqual([]);
  expect(renderFields([{ name: "Vide", value: "" }])).toEqual(["-# VIDE\n—"]);
});

test("l'horodatage est ajouté au pied de page seulement à la demande", () => {
  expect(textOf(createPanel({ category: "general", title: "t" }))).not.toMatch(/<t:\d+:R>/);
  expect(textOf(createPanel({ category: "general", title: "t", timestamp: true }))).toMatch(/<t:\d+:R>/);
  expect(textOf(createPanel({ category: "general", title: "t", footer: "7 jours" }))).toContain(
    "Sakutina · Général · 7 jours",
  );
});

test("l'ensemble du texte respecte le budget, même avec des entrées démesurées, et le pied de page survit", () => {
  const panel = createPanel({
    category: "tracking",
    title: "T".repeat(5_000),
    description: "D".repeat(9_000),
    fields: Array.from({ length: 40 }, (_, index) => ({ name: `N${index}`, value: "V".repeat(2_000) })),
    footer: "F".repeat(5_000),
  });
  const total = nodesOf(panel)
    .map((node) => node.content ?? "")
    .join("").length;

  expect(total).toBeLessThanOrEqual(TEXT_BUDGET);
  expect(nodesOf(panel).length).toBeLessThanOrEqual(40);
  expect(textOf(panel)).toContain(`-# ${BOT_NAME} · Suivi`);
  expect(clamp("court", 10)).toBe("court");
  expect(clamp("abcdef", 4)).toBe("abc…");
});

test("galerie d'images, blocs d'action (Section + bouton) et rangées de contrôles", () => {
  const panel = createPanel({
    category: "economy",
    title: "Solde",
    images: [{ url: "attachment://card.png", description: "Carte" }, { url: "https://cdn.test/x.png" }],
    blocks: [
      { kind: "action", text: "Portefeuille **10**", button: button({ id: "ba:deposit-all:1", label: "Tout déposer" }) },
      { kind: "separator" },
      { kind: "text", text: "Total **10**" },
    ],
    rows: [
      buttonRow(button({ id: "a:b:1", label: "Un" }), button({ id: "a:c:1", label: "Deux", intent: "danger" })),
      selectRow({
        id: "x:y:1",
        placeholder: "Choisir",
        options: [{ label: "Option A", value: "a", selected: true }, { label: "Option B", value: "b" }],
      }),
    ],
  });
  const nodes = nodesOf(panel);
  const gallery = nodes.find((node) => node.type === ComponentTypes.mediaGallery);

  expect(gallery?.items).toHaveLength(2);
  expect(
    nodes.some((node) => node.type === ComponentTypes.section && node.accessory?.type === ComponentTypes.button),
  ).toBe(true);
  expect(nodes.filter((node) => node.type === ComponentTypes.actionRow)).toHaveLength(2);
  expect(nodes.some((node) => node.type === ComponentTypes.stringSelect)).toBe(true);
  expect(textOf(panel)).toContain("Tout déposer");
  expect(textOf(panel)).toContain("Option B");
});

test("les blocs de présentation", () => {
  expect(keyValue("Messages", 12)).toBe("Messages **12**");
  expect(label("Écriture")).toBe("-# ÉCRITURE");
  expect(stat(12, "Messages")).toBe("**12** messages");
  expect(statLine("a", "b")).toBe("a  ·  b");
  expect(bullets(["a", "b"])).toBe("• a\n• b");
  expect(ranking(["a", "b", "c", "d"])).toBe("🥇 a\n🥈 b\n🥉 c\n**4.** d");
  expect(codeBlock(["x"])).toBe("```\nx\n```");
});

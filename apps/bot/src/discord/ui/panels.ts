import {
  ContainerBuilder,
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  ThumbnailBuilder,
  MediaGalleryBuilder,
  type ActionRowBuilder,
  type ButtonBuilder,
  type MessageActionRowComponentBuilder,
} from "discord.js";

import { label } from "@/discord/ui/blocks.ts";
import {
  BOT_NAME,
  categories,
  palette,
  type Category,
  type Tone,
} from "@/discord/ui/theme.ts";

/**
 * Panneaux Components V2 : un `Container` à couleur d'accent qui regroupe texte,
 * sections, images, séparateurs et contrôles. Un message V2 ne porte ni `content`
 * ni embed ; tout passe par des composants.
 */

/** Un champ : son libellé s'affiche en petites capitales grises, sa valeur dessous. */
export type PanelField = Readonly<{ name: string; value: string }>;
export type PanelImage = Readonly<{ url: string; description?: string }>;

export type PanelBlock =
  /** Texte libre, en Markdown. */
  | Readonly<{ kind: "text"; text: string }>
  /** Texte accompagné d'un bouton à droite (composant « Section »). */
  | Readonly<{ kind: "action"; text: string; button: ButtonBuilder }>
  | Readonly<{ kind: "separator"; divider?: boolean; large?: boolean }>;

export type PanelOptions = Readonly<{
  category: Category;
  tone?: Tone;
  title?: string;
  description?: string;
  /** Champs empilés sous l'en-tête, dans un seul bloc de texte. */
  fields?: readonly PanelField[];
  /** Membre concerné : son nom en sur-titre. */
  author?: Readonly<{ name: string }>;
  /** Vignette à droite de l'en-tête (avatar, icône du serveur). */
  thumbnail?: string;
  /** Galerie d'images sous le contenu (1 à 10). `attachment://nom` pour une pièce jointe. */
  images?: readonly PanelImage[];
  blocks?: readonly PanelBlock[];
  /** Rangées de boutons ou de menus, sous le contenu. */
  rows?: readonly ActionRowBuilder<MessageActionRowComponentBuilder>[];
  /** Complément du pied de page, après « Sakutina · Catégorie ». */
  footer?: string;
  /** Ajoute « il y a… » au pied de page : pour les données qui changent. */
  timestamp?: boolean;
}>;

export type Panel = Readonly<{
  components: readonly ContainerBuilder[];
  flags: MessageFlags.IsComponentsV2;
}>;

/** Budget de texte d'un message V2, appliqué par prudence sur l'ensemble des blocs de texte. */
export const TEXT_BUDGET = 4_000;
const FOOTER_BUDGET = 400;
const MAX_COMPONENTS = 40;

const toneColors: Readonly<Record<Tone, number>> = {
  success: palette.success,
  warning: palette.warning,
  danger: palette.danger,
  info: palette.info,
};

export function clamp(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1))}…`;
}

/** Empile les champs : `-# LIBELLÉ` puis la valeur, séparés par une ligne vide. Un seul bloc de texte. */
export function renderFields(fields: readonly PanelField[]): string[] {
  if (!fields.length) return [];

  return [
    fields
      .map((field) => `${label(field.name)}\n${field.value || "—"}`)
      .join("\n\n"),
  ];
}

/**
 * Applique un budget de caractères : tronque le bloc qui dépasse et vide les suivants.
 * La liste garde sa longueur, pour que chaque bloc retrouve sa place.
 */
function withinBudget(texts: readonly string[], budget: number): string[] {
  let remaining = budget;

  return texts.map((text) => {
    if (remaining <= 0) return "";

    const clamped = clamp(text, remaining);
    remaining -= clamped.length;

    return clamped;
  });
}

const text = (content: string) => new TextDisplayBuilder().setContent(content);

const separator = (divider: boolean, large = false) =>
  new SeparatorBuilder()
    .setDivider(divider)
    .setSpacing(large ? SeparatorSpacingSize.Large : SeparatorSpacingSize.Small);

/**
 * Seul constructeur de messages du bot : couleur d'accent, en-tête, pied de page,
 * bornes de Discord. Les commandes décrivent le contenu ; le style est décidé ici.
 */
export function createPanel(options: PanelOptions): Panel {
  const category = categories[options.category];
  const container = new ContainerBuilder().setAccentColor(
    options.tone ? toneColors[options.tone] : category.color,
  );

  // 1. En-tête : sur-titre, titre, description, vignette.
  const heading = [
    options.author ? `-# ${options.author.name}` : null,
    options.title ? `## ${options.title}` : null,
    options.description ?? null,
  ]
    .filter((part): part is string => part !== null)
    .join("\n");
  const thumbnail = options.thumbnail;

  // 2. Corps : tous les textes passent par le même budget.
  const fieldBlocks = options.fields?.length ? renderFields(options.fields) : [];
  const blockTexts = (options.blocks ?? []).flatMap((block) =>
    block.kind === "text" || block.kind === "action" ? [block.text] : [],
  );
  const footerParts = [
    BOT_NAME,
    category.label,
    options.footer,
    options.timestamp ? `<t:${Math.floor(Date.now() / 1_000)}:R>` : undefined,
  ].filter(Boolean);
  // Le pied de page est réservé en premier : il ne doit jamais disparaître.
  const footerText = clamp(`-# ${footerParts.join(" · ")}`, FOOTER_BUDGET);
  const [headingText = "", ...rest] = withinBudget(
    [heading, ...fieldBlocks, ...blockTexts],
    TEXT_BUDGET - footerText.length,
  );
  const bodyTexts = rest.slice(0, fieldBlocks.length).filter((body) => body !== "");
  const blockQueue = rest.slice(fieldBlocks.length);

  if (headingText) {
    if (thumbnail) {
      container.addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(text(headingText))
          .setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbnail)),
      );
    } else {
      container.addTextDisplayComponents(text(headingText));
    }
  }

  if (bodyTexts.length) {
    container.addSeparatorComponents(separator(true));

    bodyTexts.forEach((body, index) => {
      if (index > 0) container.addSeparatorComponents(separator(false));
      container.addTextDisplayComponents(text(body));
    });
  }

  if (options.images?.length) {
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        options.images.slice(0, 10).map((image) => ({
          media: { url: image.url },
          ...(image.description ? { description: clamp(image.description, 1_024) } : {}),
        })),
      ),
    );
  }

  let queued = 0;

  for (const block of options.blocks ?? []) {
    if (block.kind === "separator") {
      container.addSeparatorComponents(separator(block.divider ?? false, block.large));
    } else if (block.kind === "text") {
      const content = blockQueue[queued++];

      if (content) container.addTextDisplayComponents(text(content));
    } else {
      container.addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(text(blockQueue[queued++] || "…"))
          .setButtonAccessory(block.button),
      );
    }
  }

  if (options.rows?.length) {
    container.addSeparatorComponents(separator(false));
    container.addActionRowComponents(...options.rows);
  }

  container.addSeparatorComponents(separator(false));
  container.addTextDisplayComponents(text(footerText));

  if (container.components.length > MAX_COMPONENTS) {
    throw new Error(`Panel exceeds ${MAX_COMPONENTS} components`);
  }

  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

type Semantic = Omit<PanelOptions, "tone"> & { title: string };

export const successPanel = (options: Semantic) =>
  createPanel({ ...options, tone: "success" });

export const warningPanel = (options: Semantic) =>
  createPanel({ ...options, tone: "warning" });

export const errorPanel = (options: Semantic) =>
  createPanel({ ...options, tone: "danger" });

export const infoPanel = (options: Semantic) =>
  createPanel({ ...options, tone: "info" });

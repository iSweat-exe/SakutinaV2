/**
 * Identité visuelle de Sakutina : une seule source pour les couleurs, les
 * catégories et les icônes. Aucune commande ne choisit une couleur elle-même.
 */
export const BOT_NAME = "Sakutina";

/** Couleurs sémantiques, communes à toutes les catégories. */
export const palette = {
  brand: 0xf2a65a,
  success: 0x57c785,
  warning: 0xe8b84a,
  danger: 0xe5585c,
  info: 0x5aa9e6,
} as const;

/** Famille d'une réponse : fixe sa couleur d'accent et le pied de l'embed. */
export type Category = "general" | "economy" | "casino" | "tracking" | "profile" | "admin";

export const categories: Readonly<Record<Category, { label: string; color: number }>> = {
  general: { label: "Général", color: palette.brand },
  economy: { label: "Économie", color: 0xe8b84a },
  casino: { label: "Casino", color: 0x4f9d6b },
  tracking: { label: "Suivi", color: 0x4fb3a9 },
  profile: { label: "Profil", color: palette.brand },
  admin: { label: "Administration", color: 0x8892a6 },
};

/** Ton d'une réponse : remplace la couleur de la catégorie (succès, alerte, erreur…). */
export type Tone = "success" | "warning" | "danger" | "info";

export const medals = ["🥇", "🥈", "🥉"] as const;

/** Limites imposées par Discord sur un embed. */
export const limits = {
  title: 256,
  description: 4096,
  fieldName: 256,
  fieldValue: 1024,
  fields: 25,
  footer: 2048,
  author: 256,
} as const;

import { medals } from "@/discord/ui/theme.ts";

/** Libellé de section : petites capitales grises (`-# PORTEFEUILLE`). */
export function label(text: string): string {
  return `-# ${text.toUpperCase()}`;
}

/** « **12** messages » : le nombre en gras, puis son nom en minuscules. */
export function stat(value: string | number, noun: string): string {
  return `**${value}** ${noun.toLowerCase()}`;
}

/** Statistiques sur une ligne, séparées par « · ». */
export function statLine(...parts: readonly string[]): string {
  return parts.join("  ·  ");
}

/** « Messages **12** » : un libellé et sa valeur en gras, sur une ligne. */
export function keyValue(label: string, value: string | number): string {
  return `${label} **${value}**`;
}

/** Plusieurs lignes dans une même valeur de champ. */
export function lines(...rows: readonly string[]): string {
  return rows.join("\n");
}

export function bullets(items: readonly string[]): string {
  return items.map((item) => `• ${item}`).join("\n");
}

/** Liste classée : médailles pour le podium, numéros ensuite. */
export function ranking(rows: readonly string[]): string {
  return rows
    .map((row, index) => `${medals[index] ?? `**${index + 1}.**`} ${row}`)
    .join("\n");
}

export function codeBlock(rows: readonly string[]): string {
  return ["```", ...rows, "```"].join("\n");
}

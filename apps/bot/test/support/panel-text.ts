import type { Panel } from "@/discord/ui/panels.ts";

type Json = {
  type?: number;
  content?: string;
  label?: string;
  custom_id?: string;
  accent_color?: number;
  components?: Json[];
  accessory?: Json;
  options?: { label: string }[];
  items?: { description?: string; media?: { url: string } }[];
  disabled?: boolean;
  style?: number;
};

/** Types de composants V2 utilisés par les panneaux (Discord Components Reference). */
export const ComponentTypes = {
  actionRow: 1,
  button: 2,
  stringSelect: 3,
  section: 9,
  textDisplay: 10,
  thumbnail: 11,
  mediaGallery: 12,
  separator: 14,
  container: 17,
} as const;

function toJson(value: unknown): Json {
  return (value as { toJSON(): Json }).toJSON();
}

function walk(node: Json, visit: (node: Json) => void): void {
  visit(node);

  for (const child of node.components ?? []) walk(child, visit);
  if (node.accessory) walk(node.accessory, visit);
}

/** Aplatit un panneau (ou la charge utile d'une réponse) en liste de nœuds. */
export function nodesOf(payload: Panel | { components?: unknown[] } | undefined): Json[] {
  const nodes: Json[] = [];

  for (const component of payload?.components ?? []) {
    walk(toJson(component), (node) => nodes.push(node));
  }

  return nodes;
}

/** Tout le texte lisible : textes, étiquettes de boutons, options de menus. */
export function textOf(payload: Panel | { components?: unknown[] } | undefined): string {
  return nodesOf(payload)
    .flatMap((node) => [
      node.content,
      node.label,
      ...(node.options ?? []).map((option) => option.label),
      ...(node.items ?? []).map((item) => item.description),
    ])
    .filter((value): value is string => Boolean(value))
    .join("\n");
}

export function buttonsOf(payload: Panel | { components?: unknown[] } | undefined): Json[] {
  return nodesOf(payload).filter((node) => node.type === ComponentTypes.button);
}

export function findButton(
  payload: Panel | { components?: unknown[] } | undefined,
  label: string,
): Json | undefined {
  return buttonsOf(payload).find((node) => node.label === label);
}

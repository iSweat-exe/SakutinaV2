import type { Plan } from "./plan.ts";

export type Check = Readonly<{ label: string; command: readonly string[]; cwd: string }>;

/** Ce que renvoie un générateur : les fichiers à écrire, les vérifications à lancer, et la suite à faire à la main. */
export type Generated = Readonly<{
  plan: Plan;
  checks: readonly Check[];
  /** Ce que le générateur ne peut pas faire à votre place. */
  next: readonly string[];
}>;

import { balanceComponents } from "@/discord/components/balance.ts";
import { forgetComponents } from "@/discord/components/forget.ts";
import type { ComponentHandler } from "@/discord/components/handler.ts";
import { historyComponents } from "@/discord/components/history.ts";
import { leaderboardComponents } from "@/discord/components/leaderboard.ts";
import { statsComponents } from "@/discord/components/stats.ts";

/** Seule liste des gestionnaires de composants : un par espace de noms d'identifiant. */
export const componentHandlers: readonly ComponentHandler[] = [
  leaderboardComponents,
  statsComponents,
  historyComponents,
  balanceComponents,
  forgetComponents,
];

export function findComponentHandler(namespace: string): ComponentHandler | undefined {
  return componentHandlers.find((handler) => handler.namespace === namespace);
}

import { ActivityType, type Presence } from "discord.js";

import type { GameKind } from "@/domain/phaethon/phaethon-types.ts";
import type { ObservedGame, ObservedPresence } from "@/domain/phaethon/presence-sessions.ts";

const kinds: Readonly<Partial<Record<ActivityType, GameKind>>> = {
  [ActivityType.Playing]: "playing",
  [ActivityType.Streaming]: "streaming",
  [ActivityType.Listening]: "listening",
  [ActivityType.Watching]: "watching",
  [ActivityType.Competing]: "competing",
};

/**
 * Ce que le bot retient d'une présence Discord : le statut et le nom des activités.
 * Le statut personnalisé (texte libre) et les détails (titre d'un morceau…) sont ignorés.
 */
export function observePresence(presence: Presence | null | undefined): ObservedPresence {
  if (!presence) {
    return { status: "offline", games: [] };
  }

  const status =
    presence.status === "online" || presence.status === "idle" || presence.status === "dnd"
      ? presence.status
      : "offline";
  const games = presence.activities.flatMap((activity): ObservedGame[] => {
    const kind = kinds[activity.type];

    return kind ? [{ name: activity.name, kind }] : [];
  });

  return { status, games };
}

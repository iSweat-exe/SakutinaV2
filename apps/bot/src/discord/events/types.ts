import type { ClientEvents } from "discord.js";

import type { HandlerContext } from "@/discord/handler-context.ts";

/** Un événement Discord = son nom, s'il est unique (`once`) et son handler. */
export type EventHandler<K extends keyof ClientEvents = keyof ClientEvents> =
  Readonly<{
    name: K;
    once?: boolean;
    execute: (
      context: HandlerContext,
      ...args: ClientEvents[K]
    ) => Promise<void> | void;
  }>;

/** Garde le typage des arguments de l'événement à la déclaration. */
export function defineEvent<K extends keyof ClientEvents>(
  event: EventHandler<K>,
): EventHandler<K> {
  return event;
}

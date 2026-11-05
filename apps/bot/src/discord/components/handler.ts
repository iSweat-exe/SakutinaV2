import type { MessageComponentInteraction, ModalSubmitInteraction } from "discord.js";

import type { ComponentId } from "@/discord/components/custom-id.ts";
import type { Invoker } from "@/discord/commands/command.ts";
import type { HandlerContext } from "@/discord/handler-context.ts";

export type ComponentInteraction = MessageComponentInteraction | ModalSubmitInteraction;

/**
 * Gère les composants d'un espace de noms (`lb`, `st`, `ba`…). Le routeur a déjà
 * vérifié le serveur et que l'utilisateur est le propriétaire du message.
 */
export type ComponentHandler = Readonly<{
  namespace: string;
  handle: (
    interaction: ComponentInteraction,
    context: HandlerContext,
    id: ComponentId,
    invoker: Invoker,
  ) => Promise<void>;
}>;

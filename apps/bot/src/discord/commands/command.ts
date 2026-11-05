import type {
  ChatInputCommandInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord.js";

import type { HandlerContext } from "@/discord/handler-context.ts";
import type { Role } from "@/domain/permissions/permissions.ts";

/** Qui exécute la commande : permet à une commande d'ouvrir certaines options à un rôle plus élevé. */
export type Invoker = Readonly<{ role: Role }>;

/** Une commande = sa définition Discord, le rôle minimal et son handler. */
export type Command = Readonly<{
  definition: RESTPostAPIChatInputApplicationCommandsJSONBody;
  requiredRole: Role;
  execute: (
    interaction: ChatInputCommandInteraction,
    context: HandlerContext,
    invoker: Invoker,
  ) => Promise<void>;
}>;

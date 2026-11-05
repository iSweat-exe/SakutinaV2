import type {
  APIApplicationCommandSubcommandOption,
  ChatInputCommandInteraction,
} from "discord.js";

import type { HandlerContext } from "@/discord/handler-context.ts";
import type { Role } from "@/domain/permissions/permissions.ts";

/** Qui exécute la commande : permet à une commande d'ouvrir certaines options à un rôle plus élevé. */
export type Invoker = Readonly<{ role: Role }>;

/**
 * Une commande = une sous-commande Discord : sa définition, le rôle minimal et son handler.
 * Le rôle se règle par sous-commande : un même groupe mêle membres et administrateurs.
 */
export type Command = Readonly<{
  definition: APIApplicationCommandSubcommandOption;
  requiredRole: Role;
  execute: (
    interaction: ChatInputCommandInteraction,
    context: HandlerContext,
    invoker: Invoker,
  ) => Promise<void>;
}>;

/**
 * Un groupe = une commande Discord de premier niveau (`/economy`) qui rassemble ses
 * sous-commandes (`/economy balance`). Au-delà de 25 sous-commandes, Discord impose
 * de scinder : `/casino`, puis `/casino2`, etc. (voir `applicationCommands`).
 */
export type CommandGroup = Readonly<{
  name: string;
  description: string;
  commands: readonly Command[];
}>;

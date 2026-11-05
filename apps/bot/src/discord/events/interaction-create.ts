import {
  Events,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type MessageComponentInteraction,
  type ModalSubmitInteraction,
} from "discord.js";

import type { AppConfig } from "@sakutina/config";

import { commandPath, findCommand } from "@/discord/commands/index.ts";
import { parseId } from "@/discord/components/custom-id.ts";
import { findComponentHandler } from "@/discord/components/index.ts";
import { defineEvent } from "@/discord/events/types.ts";
import type { HandlerContext } from "@/discord/handler-context.ts";
import { messages } from "@/discord/messages.ts";
import { errorPanel } from "@/discord/ui/panels.ts";
import { respondPrivately, type Repliable } from "@/discord/ui/replies.ts";
import { logger } from "@/shared/logger.ts";
import {
  hasRole,
  resolveRole,
  type Role,
} from "@/domain/permissions/permissions.ts";

type GuildInteraction =
  | ChatInputCommandInteraction
  | MessageComponentInteraction
  | ModalSubmitInteraction;

function roleOf(interaction: GuildInteraction, config: AppConfig): Role {
  const memberRoles = interaction.member?.roles;

  return resolveRole(
    {
      isGuildOwner: interaction.guild?.ownerId === interaction.user.id,
      hasAdministrator:
        interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ===
        true,
      canModerate:
        interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers) ===
        true,
      memberRoleIds: Array.isArray(memberRoles)
        ? memberRoles
        : (memberRoles?.cache.map((role) => role.id) ?? []),
    },
    config,
  );
}

async function refuse(
  interaction: Repliable,
  title: string,
  description: string,
): Promise<void> {
  await respondPrivately(
    interaction,
    errorPanel({ category: "general", title, description }),
  );
}

async function handleCommand(
  context: HandlerContext,
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const command = findCommand(interaction.commandName, interaction.options.getSubcommand(false));

  if (!command) {
    return;
  }

  if (interaction.guildId !== context.config.primaryGuildId) {
    await refuse(interaction, messages.errors.wrongGuildTitle, messages.errors.wrongGuild);
    return;
  }

  const role = roleOf(interaction, context.config);

  if (!hasRole(role, command.requiredRole)) {
    await refuse(interaction, messages.errors.unauthorizedTitle, messages.errors.unauthorized);
    return;
  }

  await command.execute(interaction, context, { role });
}

/**
 * Boutons, menus et modales : l'identifiant désigne l'espace de noms et le
 * propriétaire. Seul celui qui a lancé la commande peut utiliser ses contrôles.
 */
async function handleComponent(
  context: HandlerContext,
  interaction: MessageComponentInteraction | ModalSubmitInteraction,
): Promise<void> {
  const id = parseId(interaction.customId);
  const handler = id ? findComponentHandler(id.namespace) : undefined;

  if (!id || !handler) {
    return;
  }

  if (interaction.guildId !== context.config.primaryGuildId) {
    await refuse(interaction, messages.errors.wrongGuildTitle, messages.errors.wrongGuild);
    return;
  }

  if (id.ownerId !== interaction.user.id) {
    await refuse(interaction, messages.errors.notYoursTitle, messages.errors.notYours);
    return;
  }

  await handler.handle(interaction, context, id, {
    role: roleOf(interaction, context.config),
  });
}

/** Route commandes, boutons, menus et modales après contrôle du serveur, du rôle et du propriétaire. */
export const interactionCreate = defineEvent({
  name: Events.InteractionCreate,
  async execute(context, interaction) {
    try {
      if (interaction.isChatInputCommand()) {
        await handleCommand(context, interaction);
      } else if (interaction.isMessageComponent() || interaction.isModalSubmit()) {
        await handleComponent(context, interaction);
      }
    } catch (error) {
      logger.error("Failed to handle Discord interaction", {
        interaction: interaction.isChatInputCommand()
          ? commandPath(interaction.commandName, interaction.options.getSubcommand(false))
          : "customId" in interaction
            ? interaction.customId
            : interaction.type,
        error: error instanceof Error ? error.message : String(error),
      });

      if (interaction.isChatInputCommand() || interaction.isMessageComponent() || interaction.isModalSubmit()) {
        await refuse(interaction, messages.errors.internalTitle, messages.errors.internal).catch(
          () => undefined,
        );
      }
    }
  },
});

import type { Client, ClientEvents } from "discord.js";

import type { HandlerContext } from "@/discord/handler-context.ts";
import { logger } from "@/shared/logger.ts";
import { channelCreate } from "@/discord/events/channel-create.ts";
import { channelDelete } from "@/discord/events/channel-delete.ts";
import { channelUpdate } from "@/discord/events/channel-update.ts";
import { guildBanAdd } from "@/discord/events/guild-ban-add.ts";
import { guildBanRemove } from "@/discord/events/guild-ban-remove.ts";
import { guildCreate } from "@/discord/events/guild-create.ts";
import { guildDelete } from "@/discord/events/guild-delete.ts";
import { guildMemberAdd } from "@/discord/events/guild-member-add.ts";
import { guildMemberUpdate } from "@/discord/events/guild-member-update.ts";
import { guildMemberRemove } from "@/discord/events/guild-member-remove.ts";
import { guildUpdate } from "@/discord/events/guild-update.ts";
import { interactionCreate } from "@/discord/events/interaction-create.ts";
import { messageCreate } from "@/discord/events/message-create.ts";
import { messageReactionAdd } from "@/discord/events/message-reaction-add.ts";
import { presenceUpdate } from "@/discord/events/presence-update.ts";
import { ready } from "@/discord/events/ready.ts";
import { roleCreate } from "@/discord/events/role-create.ts";
import { roleDelete } from "@/discord/events/role-delete.ts";
import { roleUpdate } from "@/discord/events/role-update.ts";
import { userUpdate } from "@/discord/events/user-update.ts";
import type { EventHandler } from "@/discord/events/types.ts";
import { voiceStateUpdate } from "@/discord/events/voice-state-update.ts";

/** Seule liste d'événements : ajouter un événement = un fichier + une ligne ici. */
export const events = [
  ready,
  messageCreate,
  voiceStateUpdate,
  guildMemberAdd,
  guildMemberRemove,
  messageReactionAdd,
  guildMemberUpdate,
  userUpdate,
  presenceUpdate,
  interactionCreate,
  guildCreate,
  guildUpdate,
  guildDelete,
  roleCreate,
  roleUpdate,
  roleDelete,
  guildBanAdd,
  guildBanRemove,
  channelCreate,
  channelUpdate,
  channelDelete,
] as const;

export function registerEvents(client: Client, context: HandlerContext): void {
  for (const event of events as readonly EventHandler[]) {
    const listener = async (...args: ClientEvents[keyof ClientEvents]) => {
      try {
        await (event.execute as (...a: unknown[]) => unknown)(context, ...args);
      } catch (error) {
        logger.error("Event handler failed", {
          event: event.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    if (event.once) {
      client.once(event.name, listener);
    } else {
      client.on(event.name, listener);
    }
  }
}

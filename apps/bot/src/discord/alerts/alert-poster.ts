import type { Client } from "discord.js";

import { messages } from "@/discord/messages.ts";
import { warningPanel } from "@/discord/ui/panels.ts";
import { post } from "@/discord/ui/replies.ts";
import type { GuildService } from "@/domain/guilds/guild-service.ts";
import type { Alert } from "@/domain/phaethon/phaethon-types.ts";
import { logger } from "@/shared/logger.ts";

/**
 * Publie les alertes d'un serveur dans son salon d'alertes (`guild_settings`). Sans salon configuré,
 * ou en cas d'échec, l'alerte est seulement journalisée.
 */
export type AlertPoster = (guildId: string, alerts: readonly Alert[]) => Promise<void>;

export function alertPanel(alert: Alert) {
  const text = messages.phaethon.alerts[alert.kind];

  return warningPanel({
    category: "admin",
    title: text.title,
    description: text.text(`<@${alert.memberId}>`, alert.measured, alert.threshold),
    footer: messages.phaethon.alerts.posted,
    timestamp: true,
  });
}

export function createAlertPoster(client: Client, guildService: GuildService): AlertPoster {
  return async (guildId, alerts) => {
    if (alerts.length === 0) {
      return;
    }

    const { alertChannelId: channelId } = await guildService.settings(guildId);

    if (!channelId) {
      logger.info("Phaethon alerts raised but the guild has no alert channel", {
        guildId,
        alerts: alerts.map((alert) => `${alert.kind}:${alert.memberId}`),
      });
      return;
    }

    try {
      const channel = await client.channels.fetch(channelId);

      // Un salon d'un autre serveur ne reçoit jamais les alertes de celui-ci.
      if (!channel || channel.isDMBased() || channel.guildId !== guildId || !channel.isSendable()) {
        throw new Error("Alert channel is not a text channel of this guild the bot can write in");
      }

      for (const alert of alerts) {
        await post(channel, alertPanel(alert));
      }
    } catch (error) {
      logger.warn("Could not post phaethon alerts", {
        guildId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
}

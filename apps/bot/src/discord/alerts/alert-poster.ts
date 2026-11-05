import type { Client } from "discord.js";

import type { AppConfig } from "@sakutina/config";

import { messages } from "@/discord/messages.ts";
import { warningPanel } from "@/discord/ui/panels.ts";
import { post } from "@/discord/ui/replies.ts";
import type { Alert } from "@/domain/phaethon/phaethon-types.ts";
import { logger } from "@/shared/logger.ts";

/** Publie des alertes. Sans salon configuré ou en cas d'échec, l'alerte est seulement journalisée. */
export type AlertPoster = (alerts: readonly Alert[]) => Promise<void>;

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

export function createAlertPoster(client: Client, config: AppConfig): AlertPoster {
  return async (alerts) => {
    if (alerts.length === 0) {
      return;
    }

    const channelId = config.alertChannelId;

    if (!channelId) {
      logger.info("Phaethon alerts raised but ALERT_CHANNEL_ID is not set", {
        alerts: alerts.map((alert) => `${alert.kind}:${alert.memberId}`),
      });
      return;
    }

    try {
      const channel = await client.channels.fetch(channelId);

      if (!channel?.isSendable()) {
        throw new Error("Alert channel is not a text channel the bot can write in");
      }

      for (const alert of alerts) {
        await post(channel, alertPanel(alert));
      }
    } catch (error) {
      logger.warn("Could not post phaethon alerts", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
}

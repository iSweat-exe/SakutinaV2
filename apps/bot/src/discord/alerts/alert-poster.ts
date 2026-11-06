import type { Client } from "discord.js";

import { messages } from "@/discord/messages.ts";
import { warningPanel, type Panel } from "@/discord/ui/panels.ts";
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

/** Publie un panneau dans le salon d'alertes d'un serveur ; `false` sans salon configuré ou en cas d'échec (journalisé). */
export type ChannelPoster = (guildId: string, panel: Panel) => Promise<boolean>;

export function createChannelPoster(client: Client, guildService: GuildService): ChannelPoster {
  return async (guildId, panel) => {
    const { alertChannelId: channelId } = await guildService.settings(guildId);

    if (!channelId) {
      logger.info("Alert raised but the guild has no alert channel", { guildId });
      return false;
    }

    try {
      const channel = await client.channels.fetch(channelId);

      // Un salon d'un autre serveur ne reçoit jamais les alertes de celui-ci.
      if (!channel || channel.isDMBased() || channel.guildId !== guildId || !channel.isSendable()) {
        throw new Error("Alert channel is not a text channel of this guild the bot can write in");
      }

      await post(channel, panel);
      return true;
    } catch (error) {
      logger.warn("Could not post an alert", { guildId, error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  };
}

/** Alertes de Phaéthon : rien n'est publié quand le module est coupé sur ce serveur (`enabled`). */
export function createAlertPoster(
  client: Client,
  guildService: GuildService,
  enabled: (guildId: string) => Promise<boolean> = async () => true,
): AlertPoster {
  const postPanel = createChannelPoster(client, guildService);

  return async (guildId, alerts) => {
    if (alerts.length === 0 || !(await enabled(guildId).catch(() => true))) {
      return;
    }

    for (const alert of alerts) {
      if (!(await postPanel(guildId, alertPanel(alert)))) {
        logger.info("Phaethon alert not posted", { guildId, alert: `${alert.kind}:${alert.memberId}` });
        return;
      }
    }
  };
}

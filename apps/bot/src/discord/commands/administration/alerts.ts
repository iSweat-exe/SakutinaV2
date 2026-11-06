import { ChannelType, PermissionFlagsBits, SlashCommandSubcommandBuilder } from "discord.js";

import type { Command } from "@/discord/commands/command.ts";
import { guildIdOf } from "@/discord/guild.ts";
import { messages } from "@/discord/messages.ts";
import { errorPanel, infoPanel, successPanel } from "@/discord/ui/panels.ts";
import { post, respondPrivately } from "@/discord/ui/replies.ts";
import { logger } from "@/shared/logger.ts";

/** `/server alerts` : voir, choisir ou retirer le salon d'alertes du serveur. */
export const alertsCommand: Command = {
  definition: new SlashCommandSubcommandBuilder()
    .setName("alerts")
    .setDescription(messages.admin.alerts.description)
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription(messages.admin.alerts.channelOption)
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
    )
    .addBooleanOption((option) => option.setName("remove").setDescription(messages.admin.alerts.removeOption))
    .toJSON(),
  requiredRole: "admin",
  async execute(interaction, { guildService, auditLog }) {
    const text = messages.admin.alerts;
    const guildId = guildIdOf(interaction);
    const channel = interaction.options.getChannel("channel");
    const remove = interaction.options.getBoolean("remove") ?? false;
    const audit = (channelId: string | null) =>
      auditLog
        .append({
          id: crypto.randomUUID(),
          action: "settings.alerts",
          guildId,
          occurredAt: new Date(),
          actorId: interaction.user.id,
          targetId: null,
          metadata: { channel: channelId, source: "discord" },
        })
        .catch((error: unknown) => logger.error("Failed to append audit event", { error: error instanceof Error ? error.message : String(error) }));

    if (remove) {
      await guildService.setAlertChannel(guildId, null);
      await audit(null);
      await respondPrivately(interaction, successPanel({ category: "admin", title: text.title, description: text.removed }));
      return;
    }

    if (!channel) {
      const { alertChannelId } = await guildService.settings(guildId);
      await respondPrivately(
        interaction,
        infoPanel({
          category: "admin",
          title: text.title,
          description: `${alertChannelId ? text.current(`<#${alertChannelId}>`) : text.none}\n${text.hint}`,
        }),
      );
      return;
    }

    const resolved = interaction.guild?.channels.cache.get(channel.id);
    const me = interaction.guild?.members.me;
    const writable =
      resolved !== undefined &&
      me !== null &&
      me !== undefined &&
      resolved.isSendable() &&
      (resolved.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]) ?? false);

    if (!writable || !resolved.isSendable()) {
      await respondPrivately(interaction, errorPanel({ category: "admin", title: text.title, description: text.notWritable(`<#${channel.id}>`) }));
      return;
    }

    await guildService.setAlertChannel(guildId, channel.id);
    await audit(channel.id);
    await post(resolved, infoPanel({ category: "admin", title: text.title, description: text.welcome })).catch(() => undefined);
    await respondPrivately(interaction, successPanel({ category: "admin", title: text.title, description: text.set(`<#${channel.id}>`) }));
  },
};

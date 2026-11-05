import { SlashCommandBuilder } from "discord.js";

import type { Command } from "@/discord/commands/command.ts";
import { formatDuration } from "@/discord/formatting.ts";
import { messages } from "@/discord/messages.ts";
import { createPanel } from "@/discord/ui/panels.ts";
import { respondPrivately } from "@/discord/ui/replies.ts";

export const healthCommand: Command = {
  definition: new SlashCommandBuilder()
    .setName("health")
    .setDescription(messages.admin.health.description)
    .toJSON(),
  requiredRole: "admin",
  async execute(interaction, { healthService }) {
    const health = healthService.snapshot();
    const text = messages.admin.health;
    const ok = health.status === "ok";

    await respondPrivately(
      interaction,
      createPanel({
        category: "admin",
        tone: ok ? "success" : "warning",
        title: text.title,
        fields: [
          { name: text.status, value: ok ? text.ok : text.degraded },
          {
            name: text.discord,
            value: health.discord.connected ? text.connected : text.disconnected,
          },
          {
            name: text.ping,
            value:
              health.discord.websocketPingMs === null
                ? text.unavailable
                : `${health.discord.websocketPingMs} ms`,
          },
          { name: text.memory, value: `${health.memoryMb} Mo` },
          { name: text.uptime, value: formatDuration(health.uptimeSeconds * 1_000) },
          { name: text.environment, value: health.environment },
        ],
        timestamp: true,
      }),
    );
  },
};

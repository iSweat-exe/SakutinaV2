import { guildIdOf } from "@/discord/guild.ts";
import type { ComponentHandler } from "@/discord/components/handler.ts";
import { loadStats, STATS_PERIODS } from "@/discord/commands/tracking/stats-panel.ts";
import { messages } from "@/discord/messages.ts";
import { errorPanel } from "@/discord/ui/panels.ts";
import { respondPrivately, update } from "@/discord/ui/replies.ts";

/** Boutons de période de `/me stats` : le droit de voir un autre membre est revérifié à chaque clic. */
export const statsComponents: ComponentHandler = {
  namespace: "st",
  async handle(interaction, context, id, invoker) {
    if (!interaction.isButton()) {
      return;
    }

    const [targetId, rawDays] = id.args;
    const days = Number(rawDays);

    if (!targetId || !(STATS_PERIODS as readonly number[]).includes(days)) {
      return;
    }

    const target =
      targetId === interaction.user.id
        ? interaction.user
        : await interaction.client.users.fetch(targetId).catch(() => null);

    if (!target) {
      return;
    }

    const result = await loadStats(context, guildIdOf(interaction), invoker.role, interaction.user.id, target, days);

    if (result.denied) {
      await respondPrivately(
        interaction,
        errorPanel({
          category: "tracking",
          title: messages.errors.adminOnlyTitle,
          description: messages.errors.adminOnly,
        }),
      );
      return;
    }

    await update(interaction, result.panel);
  },
};

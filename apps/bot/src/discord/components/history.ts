import { guildIdOf } from "@/discord/guild.ts";
import type { ComponentHandler } from "@/discord/components/handler.ts";
import { buildHistoryPanel } from "@/discord/commands/economy/history-panel.ts";
import { update } from "@/discord/ui/replies.ts";

export const historyComponents: ComponentHandler = {
  namespace: "hi",
  async handle(interaction, context, id) {
    if (!interaction.isButton()) {
      return;
    }

    const page = Number(id.args[0]);

    if (!Number.isInteger(page) || page < 1) {
      return;
    }

    // L'historique affiché est toujours celui du propriétaire du message, jamais d'un identifiant extérieur.
    await update(interaction, await buildHistoryPanel(context, guildIdOf(interaction), id.ownerId, page));
  },
};

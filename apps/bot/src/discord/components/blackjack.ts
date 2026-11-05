import { actOnBlackjack, type BlackjackAction } from "@/discord/casino/blackjack-flow.ts";
import { replyOnEconomyError } from "@/discord/commands/economy/shared.ts";
import type { ComponentHandler } from "@/discord/components/handler.ts";
import { guildIdOf } from "@/discord/guild.ts";
import { respondPrivately, update } from "@/discord/ui/replies.ts";

const ACTIONS: readonly string[] = ["hit", "stand", "double"] satisfies BlackjackAction[];

/** Boutons d'une main de blackjack : tirer, rester, doubler. Seul le joueur de la main peut les utiliser. */
export const blackjackComponents: ComponentHandler = {
  namespace: "bj",
  async handle(interaction, context, id) {
    const gameId = id.args[0];

    if (!interaction.isButton() || !gameId || !ACTIONS.includes(id.action)) {
      return;
    }

    const { currencyName } = await context.guildService.settings(guildIdOf(interaction));

    // Un refus économique (doubler sans les fonds) est privé et laisse la main telle quelle.
    await replyOnEconomyError(interaction, currencyName, async () => {
      const result = await actOnBlackjack(interaction.user.id, context, gameId, id.action as BlackjackAction);

      if ("refused" in result) {
        await respondPrivately(interaction, result.refused);
        return;
      }

      await update(interaction, result);
    });
  },
};

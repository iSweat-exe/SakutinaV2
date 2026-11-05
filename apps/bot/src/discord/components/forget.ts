import {
  buildForgetCancelled,
  buildForgetDone,
} from "@/discord/commands/tracking/forget-panel.ts";
import type { ComponentHandler } from "@/discord/components/handler.ts";
import { update } from "@/discord/ui/replies.ts";

/** Confirmation de `/forgetme` : seul « Effacer » supprime quoi que ce soit. */
export const forgetComponents: ComponentHandler = {
  namespace: "fg",
  async handle(interaction, { config, activityService, memberService, phaethonService }, id) {
    if (!interaction.isButton()) {
      return;
    }

    if (id.action === "confirm") {
      // Les données effacées sont toujours celles de l'utilisateur qui clique, vérifié propriétaire par le routeur.
      await activityService.forget(config.primaryGuildId, interaction.user.id);
      await phaethonService.forget(config.primaryGuildId, interaction.user.id);
      await memberService.forget(config.primaryGuildId, interaction.user.id);
      await update(interaction, buildForgetDone());
    } else if (id.action === "cancel") {
      await update(interaction, buildForgetCancelled());
    }
  },
};

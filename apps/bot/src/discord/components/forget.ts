import { guildIdOf } from "@/discord/guild.ts";
import {
  buildForgetCancelled,
  buildForgetDone,
} from "@/discord/commands/tracking/forget-panel.ts";
import type { ComponentHandler } from "@/discord/components/handler.ts";
import { update } from "@/discord/ui/replies.ts";

/** Confirmation de `/me forget` : seul « Effacer » supprime quoi que ce soit. */
export const forgetComponents: ComponentHandler = {
  namespace: "fg",
  async handle(interaction, { activityService, economyService, memberService, phaethonService }, id) {
    if (!interaction.isButton()) {
      return;
    }

    if (id.action === "confirm") {
      // Les données effacées sont toujours celles de l'utilisateur qui clique, vérifié propriétaire par le routeur.
      // « Tout effacer » vaut pour tous les serveurs du bot, pas seulement celui de la commande.
      const guildIds = new Set([guildIdOf(interaction), ...interaction.client.guilds.cache.keys()]);

      for (const guildId of guildIds) {
        await activityService.forget(guildId, interaction.user.id);
        await phaethonService.forget(guildId, interaction.user.id);
        await memberService.forget(guildId, interaction.user.id);
        // L'argent ne disparaît pas : le solde retourne à la réserve du serveur, les actions au serveur.
        await economyService.forget(guildId, interaction.user.id);
      }
      await update(interaction, buildForgetDone());
    } else if (id.action === "cancel") {
      await update(interaction, buildForgetCancelled());
    }
  },
};

import type { EconomyService } from "@/domain/economy/economy-service.ts";
import type { GuildService } from "@/domain/guilds/guild-service.ts";
import { logger } from "@/shared/logger.ts";

type Dependencies = Readonly<{
  guildIds: () => readonly string[];
  guildService: Pick<GuildService, "settings">;
  economyService: Pick<EconomyService, "accrueInterest">;
}>;

/**
 * Verse les intérêts de la banque des serveurs qui les ont activés. Appelée régulièrement : le jour (UTC) est réglé
 * une seule fois par serveur (la base s'en souvient), les appels suivants ne font rien. Un serveur en échec
 * n'empêche pas les autres.
 */
export function createInterestRunner({ guildIds, guildService, economyService }: Dependencies): () => Promise<void> {
  return async () => {
    for (const guildId of guildIds()) {
      try {
        const { bankInterestPermille } = await guildService.settings(guildId);
        const run = bankInterestPermille > 0 ? await economyService.accrueInterest(guildId, bankInterestPermille) : null;

        if (run) {
          logger.info("Bank interest paid", { guildId, permille: bankInterestPermille, ...run });
        }
      } catch (error) {
        logger.error("Bank interest failed", { guildId, error: error instanceof Error ? error.message : String(error) });
      }
    }
  };
}

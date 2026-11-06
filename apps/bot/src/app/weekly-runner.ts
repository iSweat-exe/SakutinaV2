import type { EconomyService } from "@/domain/economy/economy-service.ts";
import type { GuildService } from "@/domain/guilds/guild-service.ts";
import { logger } from "@/shared/logger.ts";

type Dependencies = Readonly<{
  guildIds: () => readonly string[];
  guildService: Pick<GuildService, "settings">;
  economyService: Pick<EconomyService, "weekly">;
}>;

/**
 * Passage du dimanche (UTC), serveur par serveur : impôt sur la fortune, puis dividendes et impôt du casino. Appelée
 * régulièrement : la base se souvient de chaque semaine réglée, les autres appels (et les autres jours) ne font rien.
 * Un serveur en échec n'empêche pas les autres.
 */
export function createWeeklyRunner({ guildIds, guildService, economyService }: Dependencies): () => Promise<void> {
  return async () => {
    for (const guildId of guildIds()) {
      try {
        const { wealthTaxPermille, idleTaxPermille } = await guildService.settings(guildId);
        const run = await economyService.weekly(guildId, wealthTaxPermille, idleTaxPermille);

        if (run) {
          logger.info("Weekly economy run done", {
            guildId,
            membersTaxed: run.taxes.length,
            wealthTax: run.wealthTax,
            casinoProfit: run.profit,
            dividends: run.dividendsTotal,
            casinoTax: run.casinoTax,
          });
        }
      } catch (error) {
        logger.error("Weekly economy run failed", { guildId, error: error instanceof Error ? error.message : String(error) });
      }
    }
  };
}

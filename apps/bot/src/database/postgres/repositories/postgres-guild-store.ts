import { eq, notInArray, sql } from "drizzle-orm";

import type { GuildStore } from "@/domain/guilds/guild-store.ts";
import type { BotGuild, GuildSettings } from "@/domain/guilds/guild-types.ts";
import type { Database } from "../connection.ts";
import { botGuild, guildManager, guildSettings } from "../schema/index.ts";

export class PostgresGuildStore implements GuildStore {
  constructor(private readonly db: Database) {}

  async upsertGuild(guild: BotGuild): Promise<void> {
    const values = {
      name: guild.name,
      icon: guild.icon,
      banner: guild.banner,
      ownerId: guild.ownerId,
      memberCount: guild.memberCount,
      updatedAt: new Date(),
    };

    await this.db
      .insert(botGuild)
      .values({ guildId: guild.guildId, ...values })
      .onConflictDoUpdate({ target: botGuild.guildId, set: values });
  }

  async removeGuild(guildId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(guildManager).where(eq(guildManager.guildId, guildId));
      await tx.delete(botGuild).where(eq(botGuild.guildId, guildId));
    });
  }

  async retainGuilds(guildIds: readonly string[]): Promise<number> {
    // `notInArray` sur une liste vide ne filtre rien : sans serveur, tout part.
    const condition = guildIds.length > 0 ? notInArray(botGuild.guildId, [...guildIds]) : sql`true`;
    const gone = await this.db.select({ guildId: botGuild.guildId }).from(botGuild).where(condition);

    for (const { guildId } of gone) {
      await this.removeGuild(guildId);
    }

    return gone.length;
  }

  async replaceManagers(guildId: string, memberIds: readonly string[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(guildManager).where(eq(guildManager.guildId, guildId));

      if (memberIds.length > 0) {
        await tx.insert(guildManager).values(memberIds.map((memberId) => ({ guildId, memberId })));
      }
    });
  }

  async getSettings(guildId: string): Promise<GuildSettings | null> {
    const [row] = await this.db.select().from(guildSettings).where(eq(guildSettings.guildId, guildId)).limit(1);

    return row
      ? {
          guildId: row.guildId,
          adminRoleIds: row.adminRoleIds,
          moderatorRoleIds: row.moderatorRoleIds,
          alertChannelId: row.alertChannelId,
          currencyName: row.currencyName,
          dailyReward: row.dailyReward,
          startingBalance: row.startingBalance,
          transferTaxPercent: row.transferTaxPercent,
          bankInterestPermille: row.bankInterestPermille,
          casino: {
            slots: { enabled: row.casinoSlotsEnabled, maxBet: row.casinoSlotsMaxBet },
            blackjack: { enabled: row.casinoBlackjackEnabled, maxBet: row.casinoBlackjackMaxBet },
            roulette: { enabled: row.casinoRouletteEnabled, maxBet: row.casinoRouletteMaxBet },
            coinflip: { enabled: row.casinoCoinflipEnabled, maxBet: row.casinoCoinflipMaxBet },
          },
          automod: {
            spam: row.automodSpam,
            links: row.automodLinks,
            words: row.automodWords,
            mentions: row.automodMentions,
            bannedWords: row.bannedWords,
            muteMinutes: row.defaultMuteMinutes,
          },
        }
      : null;
  }

  async insertSettingsIfMissing(settings: GuildSettings): Promise<boolean> {
    const inserted = await this.db
      .insert(guildSettings)
      .values({
        guildId: settings.guildId,
        adminRoleIds: [...settings.adminRoleIds],
        moderatorRoleIds: [...settings.moderatorRoleIds],
        alertChannelId: settings.alertChannelId,
        currencyName: settings.currencyName,
        dailyReward: settings.dailyReward,
        startingBalance: settings.startingBalance,
        transferTaxPercent: settings.transferTaxPercent,
        bankInterestPermille: settings.bankInterestPermille,
        casinoSlotsEnabled: settings.casino.slots.enabled,
        casinoSlotsMaxBet: settings.casino.slots.maxBet,
        casinoBlackjackEnabled: settings.casino.blackjack.enabled,
        casinoBlackjackMaxBet: settings.casino.blackjack.maxBet,
        casinoRouletteEnabled: settings.casino.roulette.enabled,
        casinoRouletteMaxBet: settings.casino.roulette.maxBet,
        casinoCoinflipEnabled: settings.casino.coinflip.enabled,
        casinoCoinflipMaxBet: settings.casino.coinflip.maxBet,
        automodSpam: settings.automod.spam,
        automodLinks: settings.automod.links,
        automodWords: settings.automod.words,
        automodMentions: settings.automod.mentions,
        bannedWords: [...settings.automod.bannedWords],
        defaultMuteMinutes: settings.automod.muteMinutes,
      })
      .onConflictDoNothing({ target: guildSettings.guildId })
      .returning({ guildId: guildSettings.guildId });

    return inserted.length > 0;
  }
}

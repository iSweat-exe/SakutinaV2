import { Events, type Guild } from "discord.js";

import type { HandlerContext } from "@/discord/handler-context.ts";
import { logger } from "@/shared/logger.ts";
import { observePresence } from "@/discord/presence.ts";
import { defineEvent } from "@/discord/events/types.ts";

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Sessions vocales et présences déjà en cours, tous serveurs confondus. Les trackers repartent
 * de zéro à chaque `hydrate` : on les appelle une seule fois avec l'ensemble des serveurs.
 */
function hydrateSessions(
  { config, voiceSessionTracker, voiceCoPresence, presenceSessions }: HandlerContext,
  guilds: readonly Guild[],
  startedAt: Date,
): void {
  const inVoice = guilds.flatMap((guild) =>
    [...guild.voiceStates.cache.values()].flatMap((state) =>
      state.channelId !== null && !state.member?.user.bot
        ? [{ guildId: guild.id, memberId: state.id, channelId: state.channelId }]
        : [],
    ),
  );
  voiceSessionTracker.hydrate(inVoice, startedAt);
  voiceCoPresence.hydrate(inVoice, startedAt);

  if (config.trackPresence) {
    presenceSessions.hydrate(
      guilds.flatMap((guild) =>
        [...guild.presences.cache.values()]
          .filter((presence) => !presence.user?.bot)
          .map((presence) => ({ guildId: guild.id, memberId: presence.userId, observed: observePresence(presence) })),
      ),
      startedAt,
    );
  }
}

/** Fiches des membres, invitations et fiche du serveur (avec ses gestionnaires, pour le panneau). */
async function prepareGuild({ inviteTracker, memberService, guildSync }: HandlerContext, guild: Guild): Promise<void> {
  // Sans les fiches des membres déjà présents, `/server inactive` ne verrait que les membres vus en activité.
  // Le même appel remplit le cache des membres dont dépend la liste des gestionnaires.
  try {
    const members = await guild.members.fetch();
    await memberService.seed(
      guild.id,
      members.filter((member) => !member.user.bot).map((member) => ({ memberId: member.id, joinedAt: member.joinedAt })),
    );
  } catch (error) {
    logger.warn("Could not seed member profiles", { guildId: guild.id, error: errorText(error) });
  }

  try {
    await inviteTracker.initialise(guild);
  } catch (error) {
    logger.warn("Invite tracker unavailable; joins will not be attributed", { guildId: guild.id, error: errorText(error) });
  }

  await guildSync.syncNow(guild);
}

export const ready = defineEvent({
  name: Events.ClientReady,
  once: true,
  async execute(context, client) {
    const { config, guildService, voiceSessionTracker } = context;
    const guilds = [...client.guilds.cache.values()];

    logger.info("Discord client ready", {
      userId: client.user.id,
      username: client.user.tag,
      guilds: guilds.length,
    });

    // Époque mono-serveur : les réglages par variables d'environnement deviennent ceux du serveur historique.
    if (config.legacyGuildId) {
      try {
        const seeded = await guildService.seedLegacySettings({
          guildId: config.legacyGuildId,
          adminRoleIds: config.adminRoleIds,
          moderatorRoleIds: config.moderatorRoleIds,
          alertChannelId: config.alertChannelId,
        });

        if (seeded) {
          logger.info("Legacy settings copied to guild_settings", { guildId: config.legacyGuildId });
        }
      } catch (error) {
        logger.warn("Could not copy legacy settings", { error: errorText(error) });
      }
    }

    hydrateSessions(context, guilds, new Date());

    // Un serveur à la fois : `members.fetch()` passe par la passerelle, qui limite le débit.
    for (const guild of guilds) {
      await prepareGuild(context, guild);
    }

    try {
      const forgotten = await guildService.retain(guilds.map((guild) => guild.id));

      if (forgotten > 0) {
        logger.info("Guilds left while offline removed", { count: forgotten });
      }
    } catch (error) {
      logger.warn("Could not reconcile the guild list", { error: errorText(error) });
    }

    logger.info("Guilds prepared", { guilds: guilds.length, voiceSessions: voiceSessionTracker.activeCount });
  },
});

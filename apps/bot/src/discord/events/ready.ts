import { Events } from "discord.js";

import { logger } from "@/shared/logger.ts";
import { defineEvent } from "@/discord/events/types.ts";

export const ready = defineEvent({
  name: Events.ClientReady,
  once: true,
  async execute({ config, voiceSessionTracker, inviteTracker, memberService }, client) {
    logger.info("Discord client ready", {
      userId: client.user.id,
      username: client.user.tag,
    });

    const guild = client.guilds.cache.get(config.primaryGuildId);

    if (!guild) {
      logger.warn("Primary guild is not available to the bot", {
        primaryGuildId: config.primaryGuildId,
      });
      return;
    }

    // Les membres déjà en vocal au démarrage doivent être comptés dès maintenant.
    voiceSessionTracker.hydrate(
      [...guild.voiceStates.cache.values()].flatMap((state) =>
          state.channelId !== null && !state.member?.user.bot
            ? [{ guildId: guild.id, memberId: state.id, channelId: state.channelId }]
            : [],
        ),
      new Date(),
    );
    logger.info("Voice sessions hydrated", {
      guildId: guild.id,
      active: voiceSessionTracker.activeCount,
    });

    // Fiches des membres déjà présents : sans elles, `/inactive` ne verrait que les membres vus en activité.
    try {
      const members = await guild.members.fetch();
      await memberService.seed(
        guild.id,
        members
          .filter((member) => !member.user.bot)
          .map((member) => ({ memberId: member.id, joinedAt: member.joinedAt })),
      );
      logger.info("Member profiles seeded", { guildId: guild.id, members: members.size });
    } catch (error) {
      logger.warn("Could not seed member profiles", {
        guildId: guild.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      await inviteTracker.initialise(guild);
      logger.info("Invite tracker initialised", { guildId: guild.id });
    } catch (error) {
      logger.warn("Invite tracker unavailable; joins will not be attributed", {
        guildId: guild.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
});

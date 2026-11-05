import type { AppConfig } from "@sakutina/config";

import { ActivityService } from "@/domain/activity/activity-service.ts";
import { ActivityTracker } from "@/domain/activity/activity-tracker.ts";
import { VoiceSessionTracker } from "@/domain/activity/voice-session-tracker.ts";
import { EconomyService } from "@/domain/economy/economy-service.ts";
import { MemberService } from "@/domain/members/member-service.ts";
import { PhaethonService } from "@/domain/phaethon/phaethon-service.ts";
import { PhaethonTracker } from "@/domain/phaethon/phaethon-tracker.ts";
import { MAX_COPRESENCE_CHANNEL_SIZE } from "@/domain/phaethon/phaethon-rules.ts";
import { PresenceSessions } from "@/domain/phaethon/presence-sessions.ts";
import { VoiceCoPresence } from "@/domain/phaethon/voice-copresence.ts";
import { HealthService } from "@/domain/health/health-service.ts";
import { createAlertPoster } from "@/discord/alerts/alert-poster.ts";
import { createDiscordClient } from "@/discord/client.ts";
import { registerEvents } from "@/discord/events/index.ts";
import type { HandlerContext } from "@/discord/handler-context.ts";
import { InviteTracker } from "@/discord/invites/invite-tracker.ts";
import { startHealthServer } from "@/http/health-server.ts";
import { logger } from "@/shared/logger.ts";
import { startBackgroundJobs } from "./background-jobs.ts";
import { createCardRenderer } from "./card-renderer.ts";
import { createStorage } from "./storage.ts";

const SHUTDOWN_FLUSH_TIMEOUT_MS = 8_000;

/** Assemble les dépendances, démarre les tâches de fond puis connecte le bot à Discord. */
export async function startApplication(config: AppConfig): Promise<void> {
  const storage = await createStorage(config);
  const client = createDiscordClient({ trackPresence: config.trackPresence });

  const activityTracker = new ActivityTracker();
  const activityService = new ActivityService(
    activityTracker,
    storage.activityStore,
    storage.memberStore,
  );
  const memberService = new MemberService(storage.memberStore);
  const voiceSessionTracker = new VoiceSessionTracker(
    (guildId, memberId, channelId, seconds, at) =>
      activityTracker.recordVoiceSeconds(guildId, memberId, channelId, seconds, at),
  );
  const phaethonTracker = new PhaethonTracker();
  const phaethonService = new PhaethonService(
    phaethonTracker,
    storage.phaethonStore,
    activityService,
    memberService,
  );
  const presenceSessions = new PresenceSessions({
    status: (guildId, memberId, status, seconds, at) =>
      phaethonTracker.recordStatusSeconds(guildId, memberId, status, seconds, at),
    game: (guildId, memberId, name, kind, seconds, at) =>
      phaethonTracker.recordGameSeconds(guildId, memberId, name, kind, seconds, at),
  });
  const voiceCoPresence = new VoiceCoPresence(
    (guildId, memberId, otherId, seconds, at) =>
      phaethonTracker.recordInteraction(guildId, memberId, otherId, at, { voiceSeconds: seconds }),
    MAX_COPRESENCE_CHANNEL_SIZE,
  );
  const alerts = createAlertPoster(client, config);
  const healthService = new HealthService({
    environment: config.environment,
    isDiscordReady: () => client.isReady(),
    discordPing: () => client.ws.ping,
  });

  const context: HandlerContext = {
    config,
    activityTracker,
    activityService,
    memberService,
    voiceSessionTracker,
    phaethonTracker,
    phaethonService,
    presenceSessions,
    voiceCoPresence,
    alerts,
    auditLog: storage.auditLog,
    cardRenderer: createCardRenderer(),
    economyService: new EconomyService(storage.economyStore),
    healthService,
    inviteTracker: new InviteTracker(),
  };

  const healthServer = startHealthServer(config, healthService);
  const jobs = startBackgroundJobs({
    activityService,
    memberService,
    voiceSessionTracker,
    phaethonService,
    presenceSessions,
    voiceCoPresence,
    alerts,
    primaryGuildId: config.primaryGuildId,
    auditLog: storage.auditLog,
  });
  registerEvents(client, context);

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    logger.info("Shutdown signal received", { signal });
    jobs.stop();
    const closedAt = new Date();
    voiceSessionTracker.closeAll(closedAt);
    voiceCoPresence.closeAll(closedAt);
    presenceSessions.closeAll(closedAt);
    // Ne jamais bloquer l'arrêt si la base ne répond pas.
    await Promise.race([
      Promise.all([activityService.flush(), phaethonService.flush()]),
      new Promise((resolve) => setTimeout(resolve, SHUTDOWN_FLUSH_TIMEOUT_MS)),
    ]);
    healthServer.stop();
    client.destroy();
    await storage.close();
    process.exit(0);
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));

  try {
    await client.login(config.discordToken);
  } catch (error) {
    jobs.stop();
    healthServer.stop();
    await storage.close();
    throw error;
  }
}

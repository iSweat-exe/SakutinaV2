import type { AppConfig } from "@sakutina/config";

import { ActivityService } from "@/domain/activity/activity-service.ts";
import { ActivityTracker } from "@/domain/activity/activity-tracker.ts";
import { VoiceSessionTracker } from "@/domain/activity/voice-session-tracker.ts";
import { EconomyService } from "@/domain/economy/economy-service.ts";
import { MemberService } from "@/domain/members/member-service.ts";
import { HealthService } from "@/domain/health/health-service.ts";
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
  const client = createDiscordClient();

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
    voiceSessionTracker.closeAll(new Date());
    // Ne jamais bloquer l'arrêt si la base ne répond pas.
    await Promise.race([
      activityService.flush(),
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

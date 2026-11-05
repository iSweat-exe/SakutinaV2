import {
  retentionCutoff,
  type ActivityService,
} from "@/domain/activity/activity-service.ts";
import type { VoiceSessionTracker } from "@/domain/activity/voice-session-tracker.ts";
import type { MemberService } from "@/domain/members/member-service.ts";
import type { AuditLog } from "@/domain/audit/audit-event.ts";
import { logger } from "@/shared/logger.ts";

const FLUSH_INTERVAL_MS = 60_000;
const PURGE_INTERVAL_MS = 6 * 60 * 60_000;

type Dependencies = Readonly<{
  activityService: ActivityService;
  memberService: MemberService;
  voiceSessionTracker: VoiceSessionTracker;
  auditLog: AuditLog;
}>;

/**
 * Tâches périodiques : écriture de l'activité (toutes les minutes, avec point
 * de contrôle du vocal) et purge de rétention (au démarrage puis toutes les 6 h).
 */
export function startBackgroundJobs({
  activityService,
  memberService,
  voiceSessionTracker,
  auditLog,
}: Dependencies): Readonly<{ stop: () => void }> {
  const flush = async () => {
    voiceSessionTracker.checkpoint(new Date());
    await activityService.flush();
  };

  const purge = async () => {
    try {
      const now = new Date();
      const activity = await activityService.purgeExpired(now);
      const audit = await auditLog.purgeBefore(retentionCutoff(now));
      const profiles = await memberService.purgeDeparted();
      logger.info("Retention purge done", {
        activityRows: activity,
        auditEvents: audit,
        departedProfiles: profiles,
      });
    } catch (error) {
      logger.error("Retention purge failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const flushTimer = setInterval(() => void flush(), FLUSH_INTERVAL_MS);
  const purgeTimer = setInterval(() => void purge(), PURGE_INTERVAL_MS);
  void purge();

  return {
    stop: () => {
      clearInterval(flushTimer);
      clearInterval(purgeTimer);
    },
  };
}

import {
  retentionCutoff,
  type ActivityService,
} from "@/domain/activity/activity-service.ts";
import type { VoiceSessionTracker } from "@/domain/activity/voice-session-tracker.ts";
import type { MemberService } from "@/domain/members/member-service.ts";
import type { PhaethonService } from "@/domain/phaethon/phaethon-service.ts";
import type { PresenceSessions } from "@/domain/phaethon/presence-sessions.ts";
import type { VoiceCoPresence } from "@/domain/phaethon/voice-copresence.ts";
import type { AlertPoster } from "@/discord/alerts/alert-poster.ts";
import type { AuditLog } from "@/domain/audit/audit-event.ts";
import { logger } from "@/shared/logger.ts";

const FLUSH_INTERVAL_MS = 60_000;
const PURGE_INTERVAL_MS = 6 * 60 * 60_000;
const ALERT_INTERVAL_MS = 30 * 60_000;

type Dependencies = Readonly<{
  activityService: ActivityService;
  memberService: MemberService;
  voiceSessionTracker: VoiceSessionTracker;
  phaethonService: PhaethonService;
  presenceSessions: PresenceSessions;
  voiceCoPresence: VoiceCoPresence;
  alerts: AlertPoster;
  primaryGuildId: string;
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
  phaethonService,
  presenceSessions,
  voiceCoPresence,
  alerts,
  primaryGuildId,
  auditLog,
}: Dependencies): Readonly<{ stop: () => void }> {
  const flush = async () => {
    const now = new Date();
    voiceSessionTracker.checkpoint(now);
    voiceCoPresence.checkpoint(now);
    presenceSessions.checkpoint(now);
    await activityService.flush();
    await phaethonService.flush();
  };

  const evaluateAlerts = async () => {
    try {
      await alerts(await phaethonService.evaluateAlerts(primaryGuildId));
    } catch (error) {
      logger.error("Phaethon alert evaluation failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const purge = async () => {
    try {
      const now = new Date();
      const activity = await activityService.purgeExpired(now);
      const audit = await auditLog.purgeBefore(retentionCutoff(now));
      // Les données de Phaéthon des membres partis partent avant leur fiche, qui sert à les retrouver.
      const phaethonDeparted = await phaethonService.purgeDeparted();
      const phaethon = await phaethonService.purgeExpired(now);
      const profiles = await memberService.purgeDeparted();
      logger.info("Retention purge done", {
        activityRows: activity,
        auditEvents: audit,
        departedProfiles: profiles,
        phaethonRows: phaethon,
        phaethonDeparted,
      });
    } catch (error) {
      logger.error("Retention purge failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const flushTimer = setInterval(() => void flush(), FLUSH_INTERVAL_MS);
  const purgeTimer = setInterval(() => void purge(), PURGE_INTERVAL_MS);
  const alertTimer = setInterval(() => void evaluateAlerts(), ALERT_INTERVAL_MS);
  void purge();

  return {
    stop: () => {
      clearInterval(flushTimer);
      clearInterval(purgeTimer);
      clearInterval(alertTimer);
    },
  };
}

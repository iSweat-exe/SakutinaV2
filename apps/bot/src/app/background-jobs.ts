import {
  retentionCutoff,
  type ActivityService,
} from "@/domain/activity/activity-service.ts";
import type { VoiceSessionTracker } from "@/domain/activity/voice-session-tracker.ts";
import type { MemberService } from "@/domain/members/member-service.ts";
import type { ModerationService } from "@/domain/moderation/moderation-service.ts";
import type { PhaethonService } from "@/domain/phaethon/phaethon-service.ts";
import type { PresenceSessions } from "@/domain/phaethon/presence-sessions.ts";
import type { VoiceCoPresence } from "@/domain/phaethon/voice-copresence.ts";
import type { AlertPoster } from "@/discord/alerts/alert-poster.ts";
import type { AuditLog } from "@/domain/audit/audit-event.ts";
import type { SpamWindow } from "@/domain/moderation/automod.ts";
import type { SanctionService } from "@/domain/moderation/sanction-service.ts";
import { logger } from "@/shared/logger.ts";

const FLUSH_INTERVAL_MS = 60_000;
const PURGE_INTERVAL_MS = 6 * 60 * 60_000;
const ALERT_INTERVAL_MS = 30 * 60_000;
/** Délai entre deux relevés des demandes du panneau (lever un mute ou un bannissement). */
const PANEL_COMMAND_INTERVAL_MS = 5_000;

type Dependencies = Readonly<{
  activityService: ActivityService;
  memberService: MemberService;
  voiceSessionTracker: VoiceSessionTracker;
  phaethonService: PhaethonService;
  moderationService: ModerationService;
  presenceSessions: PresenceSessions;
  voiceCoPresence: VoiceCoPresence;
  alerts: AlertPoster;
  /** Serveurs où le bot est présent (lu à chaque évaluation). */
  guildIds: () => readonly string[];
  sanctionService: SanctionService;
  spamWindow: SpamWindow;
  /** Exécute les demandes en attente écrites par le panneau. */
  runPanelCommands: () => Promise<void>;
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
  moderationService,
  presenceSessions,
  voiceCoPresence,
  alerts,
  guildIds,
  sanctionService,
  spamWindow,
  runPanelCommands,
  auditLog,
}: Dependencies): Readonly<{ stop: () => void }> {
  const flush = async () => {
    const now = new Date();
    voiceSessionTracker.checkpoint(now);
    voiceCoPresence.checkpoint(now);
    presenceSessions.checkpoint(now);
    await activityService.flush();
    await phaethonService.flush();
    spamWindow.sweep(now.getTime());
  };

  const evaluateAlerts = async () => {
    for (const guildId of guildIds()) {
      try {
        await alerts(guildId, await phaethonService.evaluateAlerts(guildId));
      } catch (error) {
        logger.error("Phaethon alert evaluation failed", {
          guildId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
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
      const warnings = await moderationService.purgeExpired(now);
      const sanctions = await sanctionService.purgeExpired(now);
      const profiles = await memberService.purgeDeparted();
      logger.info("Retention purge done", {
        activityRows: activity,
        auditEvents: audit,
        departedProfiles: profiles,
        phaethonRows: phaethon,
        expiredWarnings: warnings,
        closedSanctions: sanctions,
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
  let panelBusy = false;
  const panelTimer = setInterval(() => {
    // Un relevé à la fois : un relevé lent n'est pas doublé par le suivant.
    if (panelBusy) {
      return;
    }

    panelBusy = true;
    runPanelCommands()
      .catch((error: unknown) => {
        logger.error("Panel command run failed", { error: error instanceof Error ? error.message : String(error) });
      })
      .finally(() => {
        panelBusy = false;
      });
  }, PANEL_COMMAND_INTERVAL_MS);
  void purge();

  return {
    stop: () => {
      clearInterval(flushTimer);
      clearInterval(purgeTimer);
      clearInterval(alertTimer);
      clearInterval(panelTimer);
    },
  };
}

import type { AppConfig } from "@sakutina/config";

import type { ActivityService } from "@/domain/activity/activity-service.ts";
import type { ActivityTracker } from "@/domain/activity/activity-tracker.ts";
import type { VoiceSessionTracker } from "@/domain/activity/voice-session-tracker.ts";
import type { AuditLog } from "@/domain/audit/audit-event.ts";
import type { CardRenderer } from "@/domain/cards/card-renderer.ts";
import type { EconomyService } from "@/domain/economy/economy-service.ts";
import type { HealthService } from "@/domain/health/health-service.ts";
import type { MemberService } from "@/domain/members/member-service.ts";
import type { InviteTracker } from "@/discord/invites/invite-tracker.ts";

/** Dépendances que `app/start-application.ts` fournit aux commandes et aux événements Discord. */
export type HandlerContext = Readonly<{
  config: AppConfig;
  activityTracker: ActivityTracker;
  activityService: ActivityService;
  memberService: MemberService;
  voiceSessionTracker: VoiceSessionTracker;
  auditLog: AuditLog;
  /** `null` si l'addon natif n'est pas compilé : les commandes d'image sont alors indisponibles. */
  cardRenderer: CardRenderer | null;
  economyService: EconomyService;
  healthService: HealthService;
  inviteTracker: InviteTracker;
}>;

import type { AppConfig } from "@sakutina/config";

import type { ActivityService } from "@/domain/activity/activity-service.ts";
import type { ActivityTracker } from "@/domain/activity/activity-tracker.ts";
import type { VoiceSessionTracker } from "@/domain/activity/voice-session-tracker.ts";
import type { AuditLog } from "@/domain/audit/audit-event.ts";
import type { CardRenderer } from "@/domain/cards/card-renderer.ts";
import type { EconomyService } from "@/domain/economy/economy-service.ts";
import type { ModerationService } from "@/domain/moderation/moderation-service.ts";
import type { PhaethonService } from "@/domain/phaethon/phaethon-service.ts";
import type { PhaethonTracker } from "@/domain/phaethon/phaethon-tracker.ts";
import type { PresenceSessions } from "@/domain/phaethon/presence-sessions.ts";
import type { VoiceCoPresence } from "@/domain/phaethon/voice-copresence.ts";
import type { AlertPoster } from "@/discord/alerts/alert-poster.ts";
import type { HealthService } from "@/domain/health/health-service.ts";
import type { MemberService } from "@/domain/members/member-service.ts";
import type { InviteTracker } from "@/discord/invites/invite-tracker.ts";
import type { GuildSync } from "@/discord/guilds/guild-sync.ts";
import type { GuildService } from "@/domain/guilds/guild-service.ts";
import type { SpamWindow } from "@/domain/moderation/automod.ts";
import type { SanctionService } from "@/domain/moderation/sanction-service.ts";

/** Dépendances que `app/start-application.ts` fournit aux commandes et aux événements Discord. */
export type HandlerContext = Readonly<{
  config: AppConfig;
  activityTracker: ActivityTracker;
  activityService: ActivityService;
  memberService: MemberService;
  voiceSessionTracker: VoiceSessionTracker;
  moderationService: ModerationService;
  phaethonTracker: PhaethonTracker;
  phaethonService: PhaethonService;
  presenceSessions: PresenceSessions;
  voiceCoPresence: VoiceCoPresence;
  /** Publie les alertes de Phaéthon dans le salon des administrateurs. */
  alerts: AlertPoster;
  auditLog: AuditLog;
  /** `null` si l'addon natif n'est pas compilé : les commandes d'image sont alors indisponibles. */
  cardRenderer: CardRenderer | null;
  economyService: EconomyService;
  healthService: HealthService;
  inviteTracker: InviteTracker;
  /** Serveurs du bot et réglages propres à chacun. */
  guildService: GuildService;
  /** Tient la fiche et les gestionnaires de chaque serveur à jour pour le panneau. */
  guildSync: GuildSync;
  /** Mutes et bannissements actifs (ce que le panneau affiche et peut lever). */
  sanctionService: SanctionService;
  /** Mémoire à court terme du filtre de spam. */
  spamWindow: SpamWindow;
}>;

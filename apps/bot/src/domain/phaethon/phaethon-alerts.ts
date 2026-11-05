import type { Counters } from "@/domain/activity/counters.ts";
import type { MemberProfile } from "@/domain/members/member-profile.ts";
import {
  GONE_QUIET_BASELINE_MESSAGES,
  GONE_QUIET_BASELINE_VOICE_SECONDS,
  GONE_QUIET_DAYS,
  IDENTITY_CHURN_CHANGES,
  SPIKE_FACTOR,
  SPIKE_MIN_MESSAGES,
  SUSPICIOUS_ACCOUNT_DAYS,
} from "./phaethon-rules.ts";
import type { Alert } from "./phaethon-types.ts";

const DAY_MS = 86_400_000;

/** Un compte Discord créé très récemment qui rejoint le serveur. */
export function suspiciousAccount(memberId: string, createdAt: Date, now: Date): Alert | null {
  const ageDays = (now.getTime() - createdAt.getTime()) / DAY_MS;

  return ageDays < SUSPICIOUS_ACCOUNT_DAYS
    ? { kind: "suspicious-account", memberId, measured: Math.floor(ageDays), threshold: SUSPICIOUS_ACCOUNT_DAYS, at: now }
    : null;
}

/** Beaucoup de changements de nom ou d'avatar en peu de temps. */
export function identityChurn(memberId: string, changes: number, now: Date): Alert | null {
  return changes >= IDENTITY_CHURN_CHANGES
    ? { kind: "identity-churn", memberId, measured: changes, threshold: IDENTITY_CHURN_CHANGES, at: now }
    : null;
}

/** Un membre régulier (sur 30 jours) qui ne donne plus signe de vie. */
export function goneQuiet(
  profile: MemberProfile,
  window: Counters,
  now: Date,
): Alert | null {
  if (profile.leftAt || !profile.lastActiveAt) {
    return null;
  }

  const regular =
    window.messages >= GONE_QUIET_BASELINE_MESSAGES ||
    window.voiceSeconds >= GONE_QUIET_BASELINE_VOICE_SECONDS;
  const idleDays = (now.getTime() - profile.lastActiveAt.getTime()) / DAY_MS;

  return regular && idleDays >= GONE_QUIET_DAYS
    ? {
        kind: "gone-quiet",
        memberId: profile.memberId,
        measured: Math.floor(idleDays),
        threshold: GONE_QUIET_DAYS,
        at: now,
      }
    : null;
}

/** Un pic de messages sans commune mesure avec les habitudes du membre. */
export function activitySpike(
  memberId: string,
  today: number,
  window: Counters,
  windowDays: number,
  now: Date,
): Alert | null {
  // La moyenne exclut aujourd'hui : un pic ne doit pas relever sa propre référence.
  const dailyAverage = Math.max(1, (window.messages - today) / windowDays);
  const threshold = Math.max(SPIKE_MIN_MESSAGES, Math.ceil(dailyAverage * SPIKE_FACTOR));

  return today >= threshold
    ? { kind: "activity-spike", memberId, measured: today, threshold, at: now }
    : null;
}

/** Clé de déduplication : une même alerte n'est émise qu'une fois par période. */
export function alertKey(alert: Alert, profile?: MemberProfile | null): string {
  const day = alert.at.toISOString().slice(0, 10);

  switch (alert.kind) {
    case "suspicious-account":
      return `${alert.kind}:${alert.memberId}`;
    case "gone-quiet":
      return `${alert.kind}:${alert.memberId}:${profile?.lastActiveAt?.toISOString().slice(0, 10) ?? day}`;
    default:
      return `${alert.kind}:${alert.memberId}:${day}`;
  }
}

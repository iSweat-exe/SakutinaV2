import type { Counters } from "@/domain/activity/counters.ts";
import { inactivityReference, type MemberProfile } from "@/domain/members/member-profile.ts";
import {
  ACTIVE_WITHIN_DAYS,
  CHATTY_MESSAGES_PER_DAY,
  INACTIVE_AFTER_DAYS,
  MEDIA_SHARER_ATTACHMENTS,
  NEW_WITHIN_DAYS,
  SOCIAL_INTERACTIONS,
  TAG_WINDOW_DAYS,
  VOICE_REGULAR_SECONDS,
} from "./insight-rules.ts";

export type MemberTagId =
  | "new"
  | "active"
  | "inactive"
  | "chatty"
  | "voice-regular"
  | "social"
  | "media-sharer";

/** Une étiquette et la mesure qui l'explique : `measured` a atteint `threshold`. */
export type MemberTag = Readonly<{
  id: MemberTagId;
  measured: number;
  threshold: number;
}>;

type Input = Readonly<{
  /** Totaux du membre sur `TAG_WINDOW_DAYS` jours. */
  totals: Counters;
  profile: MemberProfile | null;
  now: Date;
}>;

const DAY_MS = 86_400_000;

const daysBetween = (from: Date, to: Date) => (to.getTime() - from.getTime()) / DAY_MS;

/** Étiquettes explicables d'un membre ; chacune porte sa mesure et son seuil. */
export function computeTags({ totals, profile, now }: Input): MemberTag[] {
  const tags: MemberTag[] = [];

  if (profile) {
    const joined = profile.joinedAt ?? profile.firstSeenAt;
    const sinceJoin = daysBetween(joined, now);

    if (sinceJoin < NEW_WITHIN_DAYS) {
      tags.push({ id: "new", measured: Math.floor(sinceJoin), threshold: NEW_WITHIN_DAYS });
    }

    const idle = daysBetween(inactivityReference(profile), now);

    if (profile.lastActiveAt && idle < ACTIVE_WITHIN_DAYS) {
      tags.push({ id: "active", measured: Math.floor(idle), threshold: ACTIVE_WITHIN_DAYS });
    } else if (idle >= INACTIVE_AFTER_DAYS) {
      tags.push({ id: "inactive", measured: Math.floor(idle), threshold: INACTIVE_AFTER_DAYS });
    }
  }

  const messagesPerDay = totals.messages / TAG_WINDOW_DAYS;

  if (messagesPerDay >= CHATTY_MESSAGES_PER_DAY) {
    tags.push({
      id: "chatty",
      measured: Math.round(messagesPerDay),
      threshold: CHATTY_MESSAGES_PER_DAY,
    });
  }

  if (totals.voiceSeconds >= VOICE_REGULAR_SECONDS) {
    tags.push({
      id: "voice-regular",
      measured: totals.voiceSeconds,
      threshold: VOICE_REGULAR_SECONDS,
    });
  }

  const interactions = totals.reactionsGiven + totals.replies + totals.mentions;

  if (interactions >= SOCIAL_INTERACTIONS) {
    tags.push({ id: "social", measured: interactions, threshold: SOCIAL_INTERACTIONS });
  }

  if (totals.attachments >= MEDIA_SHARER_ATTACHMENTS) {
    tags.push({
      id: "media-sharer",
      measured: totals.attachments,
      threshold: MEDIA_SHARER_ATTACHMENTS,
    });
  }

  return tags;
}

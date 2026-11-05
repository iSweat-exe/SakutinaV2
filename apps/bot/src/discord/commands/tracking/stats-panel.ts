import type { User } from "discord.js";

import { encodeId } from "@/discord/components/custom-id.ts";
import { discordTime, formatNumber, formatVoiceTime } from "@/discord/formatting.ts";
import type { HandlerContext } from "@/discord/handler-context.ts";
import { messages } from "@/discord/messages.ts";
import { bullets, stat, statLine } from "@/discord/ui/blocks.ts";
import { button, buttonRow } from "@/discord/ui/controls.ts";
import { createPanel, type Panel } from "@/discord/ui/panels.ts";
import { RETENTION_DAYS } from "@/domain/activity/activity-service.ts";
import type { Counters } from "@/domain/activity/counters.ts";
import { TAG_WINDOW_DAYS } from "@/domain/insights/insight-rules.ts";
import { computeTags, type MemberTag } from "@/domain/insights/member-tags.ts";
import type { MemberProfile } from "@/domain/members/member-profile.ts";
import { hasRole, type Role } from "@/domain/permissions/permissions.ts";

type StatsData = Readonly<{
  displayName: string;
  avatarUrl: string;
  days: number;
  totals: Counters;
  profile: MemberProfile | null;
  tags: readonly MemberTag[];
  /** Si présent, ajoute les boutons de période (réservés à `ownerId`). */
  controls?: Readonly<{ ownerId: string; targetId: string }>;
}>;

export const STATS_PERIODS = [7, 30] as const;

/** Présentation commune de `/stats` et de `/activity` : mêmes sections, même ordre. */
export function buildStatsPanel(data: StatsData) {
  const text = messages.tracking.stats;
  const { totals, profile } = data;
  const n = formatNumber;

  return createPanel({
    category: "tracking",
    title: text.title(data.days),
    author: { name: data.displayName },
    thumbnail: data.avatarUrl,
    fields: [
      {
        name: text.sections.writing,
        value: statLine(
          stat(n(totals.messages), text.messages),
          stat(n(totals.characters), text.characters),
          stat(n(totals.replies), text.replies),
        ),
      },
      {
        name: text.sections.media,
        value: statLine(
          stat(n(totals.attachments), text.attachments),
          stat(n(totals.mentions), text.mentions),
        ),
      },
      {
        name: text.sections.reactions,
        value: statLine(
          stat(n(totals.reactionsGiven), text.given),
          stat(n(totals.reactionsReceived), text.received),
        ),
      },
      { name: text.sections.voice, value: `**${formatVoiceTime(totals.voiceSeconds)}**` },
      {
        name: text.sections.server,
        value: statLine(
          stat(totals.joins, text.joins),
          stat(totals.leaves, text.leaves),
          stat(totals.attributedInvites, text.invites),
        ),
      },
      {
        name: text.sections.presence,
        value: statLine(
          `${text.lastActive} ${profile?.lastActiveAt ? discordTime(profile.lastActiveAt, "R") : text.neverActive}`,
          ...(profile?.joinedAt ? [`${text.joined} ${discordTime(profile.joinedAt)}`] : []),
        ),
      },
      {
        name: text.tags,
        value: data.tags.length
          ? bullets(data.tags.map((tag) => messages.tracking.tags[tag.id](tag.measured, tag.threshold)))
          : text.noTags,
      },
    ],
    footer: text.disclaimer,
    timestamp: true,
    ...(data.controls
      ? {
          rows: [
            buttonRow(
              ...STATS_PERIODS.map((period) =>
                button({
                  id: encodeId("st", "days", data.controls!.ownerId, data.controls!.targetId, period),
                  label: messages.controls.days(period),
                  intent: period === data.days ? "primary" : "neutral",
                }),
              ),
            ),
          ],
        }
      : {}),
  });
}

export type StatsResult =
  | Readonly<{ denied: true }>
  | Readonly<{ denied: false; panel: Panel }>;

/**
 * Charge et présente les statistiques d'un membre. Chacun voit les siennes ;
 * celles d'un autre membre exigent le rôle admin, vérifié à chaque appel (commande
 * comme bouton).
 */
export async function loadStats(
  context: HandlerContext,
  role: Role,
  requesterId: string,
  target: Pick<User, "id" | "displayName" | "displayAvatarURL">,
  days: number,
  withControls = true,
): Promise<StatsResult> {
  if (target.id !== requesterId && !hasRole(role, "admin")) {
    return { denied: true };
  }

  const guildId = context.config.primaryGuildId;
  const [totals, tagTotals, profile] = await Promise.all([
    context.activityService.totalsForMember(guildId, target.id, days),
    context.activityService.totalsForMember(guildId, target.id, TAG_WINDOW_DAYS),
    context.memberService.find(guildId, target.id),
  ]);

  return {
    denied: false,
    panel: buildStatsPanel({
      displayName: target.displayName,
      avatarUrl: target.displayAvatarURL({ size: 64 }),
      days: Math.min(days, RETENTION_DAYS),
      totals,
      profile,
      tags: computeTags({ totals: tagTotals, profile, now: new Date() }),
      ...(withControls ? { controls: { ownerId: requesterId, targetId: target.id } } : {}),
    }),
  };
}

import { formatNumber, formatVoiceTime, discordTime, plain } from "@/discord/formatting.ts";
import { messages } from "@/discord/messages.ts";
import { lines } from "@/discord/ui/blocks.ts";
import { createPanel, type Panel } from "@/discord/ui/panels.ts";
import type { Comparison } from "@/domain/phaethon/phaethon-types.ts";

const MAX_SHARED = 5;

export function buildComparePanel(comparison: Comparison): Panel {
  const text = messages.phaethon.compare;
  const { left, right } = comparison;
  const pair = (a: string, b: string) => `**${a}** · **${b}**`;
  const night = (share: number) => `${Math.round(share * 100)} %`;
  const last = (date: Date | null | undefined) => (date ? discordTime(date, "R") : "—");
  const direction = (value: { replies: number; mentions: number; reactions: number }) =>
    [value.replies, value.mentions, value.reactions] as const;

  return createPanel({
    category: "tracking",
    title: text.title,
    description: `<@${left.memberId}> · <@${right.memberId}>`,
    fields: [
      {
        name: text.sections.activity,
        value: lines(
          `${text.messages} ${pair(formatNumber(left.totals.messages), formatNumber(right.totals.messages))}`,
          `${text.voice} ${pair(formatVoiceTime(left.totals.voiceSeconds), formatVoiceTime(right.totals.voiceSeconds))}`,
          `${text.reactions} ${pair(formatNumber(left.totals.reactionsGiven), formatNumber(right.totals.reactionsGiven))}`,
          `${text.nightShare} ${pair(night(left.nightShare), night(right.nightShare))}`,
          `${text.lastActive} ${last(left.profile?.lastActiveAt)} · ${last(right.profile?.lastActiveAt)}`,
        ),
      },
      {
        name: text.sections.between,
        value: lines(
          text.sentTo(`<@${left.memberId}>`, `<@${right.memberId}>`, ...direction(comparison.leftToRight)),
          text.sentTo(`<@${right.memberId}>`, `<@${left.memberId}>`, ...direction(comparison.rightToLeft)),
          `${text.voiceTogether} **${formatVoiceTime(comparison.voiceTogetherSeconds)}**`,
          `${text.rhythm} **${Math.round(comparison.rhythmSimilarity * 100)} %**`,
        ),
      },
      {
        name: text.sections.common,
        value: lines(
          `${text.contacts} ${
            comparison.sharedContacts.length
              ? comparison.sharedContacts.slice(0, MAX_SHARED).map((id) => `<@${id}>`).join(" ")
              : text.nothingShared
          }`,
          `${text.games} ${
            comparison.sharedGames.length
              ? comparison.sharedGames.slice(0, MAX_SHARED).map((name) => plain(name)).join(", ")
              : text.nothingShared
          }`,
        ),
      },
    ],
    footer: messages.phaethon.profile.footer(left.days),
    timestamp: true,
  });
}

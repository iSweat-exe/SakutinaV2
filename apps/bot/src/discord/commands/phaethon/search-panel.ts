import { formatNumber, formatVoiceTime } from "@/discord/formatting.ts";
import { messages } from "@/discord/messages.ts";
import { ranking } from "@/discord/ui/blocks.ts";
import { createPanel, type Panel } from "@/discord/ui/panels.ts";
import type { SearchCriteria, SearchHit } from "@/domain/phaethon/phaethon-types.ts";

/** Les critères actifs, en une ligne : sert au pied de page et au journal d'audit. */
export function describeCriteria(criteria: SearchCriteria): string {
  const text = messages.phaethon.search;
  const parts: string[] = [];

  if (criteria.minMessages !== undefined) parts.push(`≥ ${criteria.minMessages} msg`);
  if (criteria.minVoiceHours !== undefined) parts.push(`≥ ${criteria.minVoiceHours} h vocal`);
  if (criteria.nightOwl) parts.push(text.options.nightOwl.toLowerCase());
  if (criteria.joinedWithinDays !== undefined) parts.push(`arrivé < ${criteria.joinedWithinDays} j`);
  if (criteria.inactiveDays !== undefined) parts.push(`inactif ≥ ${criteria.inactiveDays} j`);
  if (criteria.game) parts.push(`jeu « ${criteria.game} »`);
  if (criteria.tag) parts.push(`étiquette ${criteria.tag}`);
  if (criteria.talksTo) parts.push(`échange avec ${criteria.talksTo}`);

  return parts.length ? parts.join(", ") : text.noCriteria;
}

export function buildSearchPanel(hits: readonly SearchHit[], criteria: SearchCriteria): Panel {
  const text = messages.phaethon.search;
  const rows = hits.map((hit) => {
    const parts = [
      `**${formatNumber(hit.totals.messages)}** msg`,
      `**${formatVoiceTime(hit.totals.voiceSeconds)}** vocal`,
    ];

    if (hit.nightShare > 0) {
      parts.push(text.night(Math.round(hit.nightShare * 100)));
    }

    return `<@${hit.memberId}> — ${parts.join(" · ")}`;
  });

  return createPanel({
    category: "tracking",
    title: text.title(hits.length),
    description: rows.length ? ranking(rows) : text.empty,
    footer: `${describeCriteria(criteria)} · ${text.sortedBy(text.sorts[criteria.sort])}`,
    timestamp: true,
  });
}

import { encodeId } from "@/discord/components/custom-id.ts";
import { formatCoins, formatNumber, formatVoiceTime } from "@/discord/formatting.ts";
import type { HandlerContext } from "@/discord/handler-context.ts";
import { messages } from "@/discord/messages.ts";
import { ranking } from "@/discord/ui/blocks.ts";
import { button, buttonRow, selectRow } from "@/discord/ui/controls.ts";
import { createPanel, type Panel } from "@/discord/ui/panels.ts";
import type { CounterName } from "@/domain/activity/counters.ts";
import { hasRole, type Role } from "@/domain/permissions/permissions.ts";

export const LEADERBOARD_LIMIT = 10;
export const LEADERBOARD_PERIODS = [1, 7, 30] as const;
export const DEFAULT_PERIOD = 7;

export const LEADERBOARD_CATEGORIES = ["economy", "messages", "voice", "reactions"] as const;
export type LeaderboardCategory = (typeof LEADERBOARD_CATEGORIES)[number];

export function isLeaderboardCategory(value: string): value is LeaderboardCategory {
  return (LEADERBOARD_CATEGORIES as readonly string[]).includes(value);
}

const activity: Record<
  Exclude<LeaderboardCategory, "economy">,
  { counter: CounterName; format: (value: number) => string }
> = {
  messages: { counter: "messages", format: formatNumber },
  voice: { counter: "voiceSeconds", format: formatVoiceTime },
  reactions: { counter: "reactionsGiven", format: formatNumber },
};

/**
 * Le classement de richesse est public (monnaie de jeu). Les classements
 * d'activité révèlent l'activité d'autres membres : ils sont réservés aux
 * administrateurs et toujours envoyés en privé.
 */
export const isPrivateCategory = (category: LeaderboardCategory) => category !== "economy";

export type LeaderboardResult =
  | Readonly<{ denied: true }>
  | Readonly<{ denied: false; panel: Panel; private: boolean }>;

export async function buildLeaderboard(
  context: HandlerContext,
  role: Role,
  ownerId: string,
  category: LeaderboardCategory,
  days: number,
): Promise<LeaderboardResult> {
  const text = messages.tracking.leaderboard;
  const guildId = context.config.primaryGuildId;
  let rows: string[];
  let scope: string;

  if (category === "economy") {
    const accounts = await context.economyService.leaderboard(guildId, LEADERBOARD_LIMIT);
    rows = accounts.map(
      (account) => `<@${account.memberId}> — **${formatCoins(account.wallet + account.bank)}**`,
    );
    scope = text.scopeEconomy;
  } else {
    if (!hasRole(role, "admin")) {
      return { denied: true };
    }

    const selected = activity[category];
    const leaders = await context.activityService.leaderboard(
      guildId,
      selected.counter,
      days,
      LEADERBOARD_LIMIT,
    );
    rows = leaders.map((row) => `<@${row.memberId}> — **${selected.format(row.value)}**`);
    scope = text.scopeDays(days);
  }

  const panel = createPanel({
    category: category === "economy" ? "economy" : "tracking",
    title: text.title(text.categories[category]),
    description: rows.length ? ranking(rows) : text.empty,
    footer: scope,
    timestamp: true,
    rows: [
      selectRow({
        id: encodeId("lb", "category", ownerId),
        placeholder: messages.controls.categoryPlaceholder,
        options: LEADERBOARD_CATEGORIES.filter(
          (option) => option === "economy" || hasRole(role, "admin"),
        ).map((option) => ({
          label: text.categories[option],
          value: option,
          selected: option === category,
        })),
      }),
      ...(category === "economy"
        ? []
        : [
            buttonRow(
              ...LEADERBOARD_PERIODS.map((period) =>
                button({
                  id: encodeId("lb", "days", ownerId, category, period),
                  label: messages.controls.days(period),
                  intent: period === days ? "primary" : "neutral",
                }),
              ),
            ),
          ]),
    ],
  });

  return { denied: false, panel, private: isPrivateCategory(category) };
}

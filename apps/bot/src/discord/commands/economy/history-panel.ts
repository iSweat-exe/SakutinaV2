import { encodeId } from "@/discord/components/custom-id.ts";
import { discordTime, formatCoins } from "@/discord/formatting.ts";
import type { HandlerContext } from "@/discord/handler-context.ts";
import { messages } from "@/discord/messages.ts";
import { button, buttonRow } from "@/discord/ui/controls.ts";
import { createPanel, type Panel } from "@/discord/ui/panels.ts";
import type { LedgerEntry, LedgerKind } from "@/domain/economy/economy-types.ts";

export const HISTORY_PAGE_SIZE = 8;

const signs: Readonly<Record<LedgerKind, string>> = {
  earn: "+",
  spend: "−",
  deposit: "→",
  withdraw: "←",
};

function line(entry: LedgerEntry, currency: string): string {
  return `**${signs[entry.kind]} ${formatCoins(entry.amount, currency)}**  ·  ${messages.economy.kinds[entry.kind]}  ·  ${discordTime(entry.createdAt, "R")}`;
}

/** Une page de l'historique (numérotée à partir de 1), avec « Précédent » et « Suivant ». */
export async function buildHistoryPanel(
  context: HandlerContext,
  guildId: string,
  memberId: string,
  page: number,
): Promise<Panel> {
  const current = Math.max(1, Math.floor(page));
  // Une entrée de plus que la page : sa présence indique qu'il existe une page suivante.
  const fetched = await context.economyService.history(
    guildId,
    memberId,
    HISTORY_PAGE_SIZE + 1,
    (current - 1) * HISTORY_PAGE_SIZE,
  );
  const entries = fetched.slice(0, HISTORY_PAGE_SIZE);
  const hasNext = fetched.length > HISTORY_PAGE_SIZE;
  const latest = entries[0];
  const text = messages.economy.history;
  const { currencyName: currency } = await context.guildService.settings(guildId);

  return createPanel({
    category: "economy",
    title: text.title,
    description: entries.length ? entries.map((entry) => line(entry, currency)).join("\n") : text.empty,
    footer: [
      messages.controls.page(current),
      ...(latest ? [text.balances(formatCoins(latest.walletAfter, currency), formatCoins(latest.bankAfter, currency))] : []),
    ].join(" · "),
    ...(current > 1 || hasNext
      ? {
          rows: [
            buttonRow(
              button({
                id: encodeId("hi", "page", memberId, current - 1),
                label: messages.controls.previous,
                disabled: current <= 1,
              }),
              button({
                id: encodeId("hi", "page", memberId, current + 1),
                label: messages.controls.next,
                disabled: !hasNext,
              }),
            ),
          ],
        }
      : {}),
  });
}

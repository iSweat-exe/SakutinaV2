import { AccessNotice } from "@/components/shell/access-notice";
import { guildIdOrNotFound } from "@/lib/guild-id";
import { getPanelAccess } from "@/lib/panel-db/access";
import { getMarket } from "@/lib/panel-db/market";
import { PERIODS, fillCandles, type Candle, type Period } from "@/lib/panel-db/market-schema";
import { MarketView } from "./market-view";

/**
 * Loads the Casino share of one server for the four candle periods with the signed-in user's session, fills the
 * periods without any move, then hands plain props to the client view. Reads cookies and the route: render it in
 * <Suspense>.
 */
export async function MarketData({ params }: Readonly<{ params: Promise<{ guildId: string }> }>) {
  const guildId = guildIdOrNotFound((await params).guildId);
  const access = await getPanelAccess(guildId);

  if (access.state !== "granted") {
    return <AccessNotice state={access.state} />;
  }

  const markets = await Promise.all(PERIODS.map((period) => getMarket(guildId, period))).catch(() => null);

  if (!markets) {
    return <AccessNotice state="unavailable" />;
  }

  const latest = markets[markets.length - 1]!;
  const now = Date.parse(latest.generatedAt);
  const candles = Object.fromEntries(
    markets.map((market) => [market.period, fillCandles(market.candles, market.period, now, latest.priceCents)]),
  ) as Record<Period, Candle[]>;

  return <MarketView market={latest} candles={candles} />;
}

export function MarketDataFallback() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))]">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[104px] rounded-2xl border border-line bg-card" />
        ))}
      </div>
      <div className="h-[640px] rounded-2xl border border-line bg-card" />
    </div>
  );
}

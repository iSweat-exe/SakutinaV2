"use client";

import { CandleChart } from "@/components/charts/candle-chart";
import { GuildAvatar } from "@/components/servers/guild-avatar";
import { Card, CardTitle } from "@/components/ui/card";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { memberAvatarUrl } from "@/lib/discord-guilds";
import { number, short } from "@/lib/format";
import type { Candle, Market, Period } from "@/lib/panel-db/market-schema";

/** The Casino share: its price, what backs it, who holds it, and its candlestick chart. */
export function MarketView({ market, candles }: Readonly<{ market: Market; candles: Readonly<Record<Period, ReadonlyArray<Candle>>> }>) {
  const unit = market.currencyName;
  const sold = market.shares - market.serverShares;
  const biggest = market.holders[0]?.shares ?? 1;

  return (
    <>
      <StatGrid>
        <StatCard label="Share price" value={(market.priceCents / 100).toFixed(2)} sub={`${unit} per share: casino account ÷ ${number(market.shares)} shares`} />
        <StatCard label="Casino account" value={short(market.fund)} sub={`${market.weekNet >= 0 ? "+" : "−"}${short(Math.abs(market.weekNet))} since last Sunday`} />
        <StatCard label="Jackpot" value={short(market.jackpot)} sub="Won with three 7s at the slots" />
        <StatCard label="Shares held by members" value={`${number(sold)} / ${number(market.shares)}`} sub="The server sells and buys back the rest" />
      </StatGrid>

      {market.opened ? null : (
        <p className="m-0 text-sm text-muted">The casino account opens the first time the bot uses this server&apos;s economy.</p>
      )}

      <CandleChart title={`CASINO / ${unit.toUpperCase()}`} candles={candles} />

      <Card labelledBy="h-holders" className="gap-3.5 px-5 py-[18px]">
        <CardTitle id="h-holders">Top shareholders</CardTitle>
        {market.holders.length === 0 ? (
          <p className="m-0 text-sm text-muted">Nobody holds Casino shares yet. Members buy them with /market buy.</p>
        ) : (
          <ol className="m-0 flex list-none flex-col gap-3 p-0">
            {market.holders.map((holder, index) => {
              const name = holder.name ?? `Member …${holder.memberId.slice(-6)}`;

              return (
                <li key={holder.memberId} className="flex items-center gap-3">
                  <span className="w-5 flex-none text-[13px] font-semibold text-muted">{index + 1}</span>
                  <GuildAvatar name={name} iconUrl={memberAvatarUrl(holder.memberId, holder.avatar)} size={32} className="border border-[#55555a] bg-selected" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex justify-between gap-2">
                      <span className="truncate text-sm font-semibold" title={`Discord ID ${holder.memberId}`}>
                        {name}
                      </span>
                      <span className="flex-none text-[13px] text-fg-dim">
                        {number(holder.shares)} {holder.shares === 1 ? "share" : "shares"} · {((holder.shares / market.shares) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <span aria-hidden="true" className="h-[5px] overflow-hidden rounded-[3px] bg-[#2a2a2d]">
                      <span className="block h-full bg-accent" style={{ width: `${Math.round((holder.shares / biggest) * 100)}%` }} />
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        <p className="m-0 text-[12.5px] leading-snug text-muted">
          Every Sunday, 20% of the casino&apos;s weekly profit goes to shareholders and 30% to the reserve. Buying and selling costs 1%.
        </p>
      </Card>
    </>
  );
}

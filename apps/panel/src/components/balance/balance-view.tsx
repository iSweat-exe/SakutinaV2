"use client";

import { useState, useId, type ReactNode } from "react";
import { CirculationChart } from "@/components/charts/circulation-chart";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { Stepper } from "@/components/ui/stepper";
import type { Economy } from "@/lib/panel-db/economy-schema";
import type { IconName } from "@/lib/icons";
import { compactAxis, dayShort, dayTitle, number } from "@/lib/format";

/** "+1.1% since yesterday", from the coins in circulation at the end of the day before and now. */
function sinceYesterday(circulation: Economy["circulation"]): string {
  const today = circulation[circulation.length - 1]?.coins ?? 0;
  const yesterday = circulation[circulation.length - 2]?.coins;

  if (yesterday === undefined) {
    return "Wallets and banks";
  }
  if (today === yesterday) {
    return "No change since yesterday";
  }
  if (yesterday === 0) {
    return `+${number(today)} since yesterday`;
  }

  const percent = ((today - yesterday) / yesterday) * 100;

  return `${percent > 0 ? "+" : ""}${percent.toFixed(Math.abs(percent) < 10 ? 1 : 0)}% since yesterday`;
}

function RuleTile({ icon, title, subtitle, children }: Readonly<{ icon: IconName; title: string; subtitle: string; children: ReactNode }>) {
  return (
    <div className="relative box-border flex flex-col gap-3.5 overflow-hidden rounded-2xl border border-line bg-raised p-[18px] hover:border-line-strong">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="flex size-10 flex-none items-center justify-center rounded-xl border border-line-strong bg-selected">
          <Icon name={icon} size={20} className="text-accent" />
        </span>
        <div className="flex flex-col gap-px">
          <span className="font-display text-[17px] font-bold">{title}</span>
          <span className="text-[12.5px] text-muted">{subtitle}</span>
        </div>
      </div>
      {children}
    </div>
  );
}

/** The server's economy as the database reports it, then the rules (not wired yet: the bot has no settings to read). */
export function BalanceView({ economy }: Readonly<{ economy: Economy }>) {
  const [currency, setCurrency] = useState("Coins");
  const [daily, setDaily] = useState(200);
  const [start, setStart] = useState(500);
  const [tax, setTax] = useState(5);
  const nameId = useId();
  const taxId = useId();

  const name = currency || "Coins";
  const net = number(Math.round((1000 * (100 - tax)) / 100));
  const biggest = economy.top[0]?.coins ?? 1;
  const lastIndex = economy.circulation.length - 1;

  return (
    <>
      <StatGrid>
        <StatCard label="Total coins" value={compactAxis(economy.coinsTotal)} sub={sinceYesterday(economy.circulation)} />
        <StatCard
          label="Average balance"
          value={number(economy.average)}
          sub={`Across ${number(economy.holders)} ${economy.holders === 1 ? "member" : "members"} with a balance`}
        />
        <StatCard label="Earned, last 24 h" value={number(economy.earned24h)} sub="Work and daily rewards" />
        <StatCard label="Spent, last 24 h" value={number(economy.spent24h)} sub="Spent by members" />
      </StatGrid>

      <div className="flex flex-wrap gap-4">
        <Card labelledBy="h-circ" className="flex-[3_1_480px] gap-2.5 px-5 pt-[18px] pb-3.5">
          <CardTitle id="h-circ">Coins in circulation, last {economy.circulation.length} days</CardTitle>
          <CirculationChart
            values={economy.circulation.map((point) => point.coins)}
            days={economy.circulation.map((point, i) => (i === lastIndex ? "Today" : dayShort(point.day)))}
            titles={economy.circulation.map((point, i) => (i === lastIndex ? `Today, ${dayTitle(point.day)} (now)` : `${dayTitle(point.day)}, end of day`))}
          />
        </Card>

        <Card labelledBy="h-top" className="flex-[2_1_340px] gap-3.5 px-5 py-[18px]">
          <CardTitle id="h-top">Top holders</CardTitle>
          {economy.top.length === 0 ? (
            <p className="m-0 text-sm text-muted">Nobody holds coins yet. Balances appear once members use /economy.</p>
          ) : (
            <ol className="m-0 flex list-none flex-col gap-3 p-0">
              {economy.top.map((holder, index) => (
                <li key={holder.memberId} className="flex items-center gap-3">
                  <span className="w-5 flex-none text-[13px] font-semibold text-muted">{index + 1}</span>
                  <Avatar size={32} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex justify-between gap-2">
                      <span className="truncate text-sm font-semibold" title={`Discord ID ${holder.memberId}`}>
                        Member …{holder.memberId.slice(-6)}
                      </span>
                      <span className="text-[13px] text-fg-dim">{number(holder.coins)}</span>
                    </div>
                    <span aria-hidden="true" className="h-[5px] overflow-hidden rounded-[3px] bg-[#2a2a2d]">
                      <span className="block h-full bg-accent" style={{ width: `${Math.round((holder.coins / biggest) * 100)}%` }} />
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <Card lock="economyRules" labelledBy="h-rules" className="gap-4 px-5 pt-[18px] pb-[22px]">
        <CardTitle id="h-rules">Economy rules</CardTitle>
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr))]">
          <RuleTile icon="coin" title="Currency" subtitle="What members see on their balance">
            <div className="box-border flex h-11 items-center gap-2.5 rounded-xl border border-line bg-bg px-3 focus-within:border-accent">
              <label htmlFor={nameId} className="sr-clip">
                Currency name
              </label>
              <input id={nameId} className="bare text-left" type="text" value={currency} onChange={(event) => setCurrency(event.target.value)} />
            </div>
            <span className="text-[12.5px] text-muted">
              Shown as <span className="font-semibold text-fg">1,250 {name}</span>
            </span>
          </RuleTile>

          <RuleTile icon="clock" title="Daily reward" subtitle="Claimed once every 24 hours">
            <Stepper label="daily reward" value={daily} step={50} unit="per day" onChange={setDaily} />
          </RuleTile>

          <RuleTile icon="card" title="Starting balance" subtitle="Given to every new member">
            <Stepper label="starting balance" value={start} step={100} unit="on join" onChange={setStart} />
          </RuleTile>

          <RuleTile icon="percent" title="Transfer tax" subtitle="Kept by the server on every transfer">
            <div className="flex items-baseline justify-between">
              <label htmlFor={taxId} className="text-[13px] text-muted">
                Rate
              </label>
              <span className="font-display text-[28px] font-bold text-accent">{tax}%</span>
            </div>
            <input id={taxId} type="range" min={0} max={25} value={tax} onChange={(event) => setTax(Number(event.target.value))} />
            <span className="text-[12.5px] text-muted">
              Sending 1,000 delivers <span className="font-semibold text-fg">{net}</span>
            </span>
          </RuleTile>
        </div>
      </Card>
    </>
  );
}

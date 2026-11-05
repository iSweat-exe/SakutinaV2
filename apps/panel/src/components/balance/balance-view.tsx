"use client";

import { useState, useId, type ReactNode } from "react";
import { CirculationChart } from "@/components/charts/circulation-chart";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Locked } from "@/components/ui/locked";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { Stepper } from "@/components/ui/stepper";
import type { IconName } from "@/lib/icons";
import { number } from "@/lib/format";

// Sample figures shown (locked) until the economy API exists.
const CIRCULATION = [1.08, 1.1, 1.13, 1.15, 1.17, 1.19, 1.2];
const DAYS = ["Fri", "Sat", "Sun", "Mon", "Tue", "Wed", "Thu"];
const TOP = [
  ["Aiko", 48200],
  ["Ren", 41950],
  ["Sora", 37400],
  ["Hana", 29880],
  ["Yuki", 25100],
] as const;

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

export function BalanceView() {
  const [currency, setCurrency] = useState("Coins");
  const [daily, setDaily] = useState(200);
  const [start, setStart] = useState(500);
  const [tax, setTax] = useState(5);
  const nameId = useId();
  const taxId = useId();

  const name = currency || "Coins";
  const net = number(Math.round((1000 * (100 - tax)) / 100));
  const biggest = TOP[0][1];

  return (
    <>
      <PageHeader title="Balance" description="See how coins move in your server and set the rules of the economy." />

      <Locked feature="economy" className="rounded-2xl">
        <StatGrid>
          <StatCard label={`Total ${name.toLowerCase()}`} value="1.20M" sub="+1.1% since yesterday" />
          <StatCard label="Average balance" value="1,430" sub="Across 840 members with a balance" />
          <StatCard label="Earned today" value="18,640" sub="Daily rewards and games" />
          <StatCard label="Spent today" value="12,910" sub="Shop, transfers and bets" />
        </StatGrid>
      </Locked>

      <div className="flex flex-wrap gap-4">
        <Card lock="economy" labelledBy="h-circ" className="flex-[3_1_480px] gap-2.5 px-5 pt-[18px] pb-3.5">
          <CardTitle id="h-circ">Coins in circulation, last 7 days</CardTitle>
          <CirculationChart values={CIRCULATION} days={DAYS} />
        </Card>

        <Card lock="economy" labelledBy="h-top" className="flex-[2_1_340px] gap-3.5 px-5 py-[18px]">
          <CardTitle id="h-top">Top holders</CardTitle>
          <ol className="m-0 flex list-none flex-col gap-3 p-0">
            {TOP.map(([holder, coins], index) => (
              <li key={holder} className="flex items-center gap-3">
                <span className="w-5 flex-none text-[13px] font-semibold text-muted">{index + 1}</span>
                <Avatar size={32} />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex justify-between gap-2">
                    <span className="text-sm font-semibold">{holder}</span>
                    <span className="text-[13px] text-fg-dim">{number(coins)}</span>
                  </div>
                  <span aria-hidden="true" className="h-[5px] overflow-hidden rounded-[3px] bg-[#2a2a2d]">
                    <span className="block h-full bg-accent" style={{ width: `${Math.round((coins / biggest) * 100)}%` }} />
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <Card lock="economy" labelledBy="h-rules" className="gap-4 px-5 pt-[18px] pb-[22px]">
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

"use client";

import Link from "next/link";
import { useState } from "react";
import { ActivityChart, ActivityLegend } from "@/components/charts/activity-chart";
import { Card, CardTitle } from "@/components/ui/card";
import { Locked } from "@/components/ui/locked";
import { StatCard } from "@/components/ui/stat-card";
import { Switch } from "@/components/ui/switch";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import {
  SAMPLE_FLAGGED,
  SAMPLE_KPIS,
  SAMPLE_LOGS,
  SAMPLE_MESSAGES,
  SAMPLE_RAID,
  SAMPLE_VOICE,
  TOGGLE_DEFS,
  type ToggleId,
} from "./sample";

type Toggles = Record<ToggleId, boolean>;

function securityOf(toggles: Toggles) {
  if (toggles.antiraid && toggles.phaethon) {
    return { label: "Protected", color: "#4ade80", sub: "No raid in progress" };
  }
  if (!toggles.antiraid && !toggles.phaethon) {
    return { label: "Unprotected", color: "#ff8a80", sub: "Anti-Raid and Phaethon are off" };
  }
  return { label: "Partial", color: "#fbbf24", sub: `${toggles.antiraid ? "Phaethon" : "Anti-Raid"} is off` };
}

/**
 * Everything under the status header. All of it is behind a lock for now
 * (no stats, settings or Phaethon API on the bot): see lib/features.ts.
 */
export function DashboardBody() {
  const [toggles, setToggles] = useState<Toggles>({ casino: true, antiraid: true, phaethon: true, profiling: false });
  const security = securityOf(toggles);

  return (
    <>
      <Locked feature="stats" className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))]">
        <StatCard
          roomy
          label="Security"
          value={
            <span className="flex items-center gap-2" style={{ color: security.color }}>
              <Icon name="shield" size={22} strokeWidth={1.9} />
              {security.label}
            </span>
          }
          sub={security.sub}
        />
        {SAMPLE_KPIS.map((kpi) => (
          <StatCard key={kpi.label} roomy label={kpi.label} value={kpi.value} sub={kpi.sub} />
        ))}
      </Locked>

      <div className="flex flex-1 flex-wrap gap-4">
        <Card lock="stats" labelledBy="h-act" className="flex-[3_1_520px] gap-3 px-5 pt-[18px] pb-3.5">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <CardTitle id="h-act" icon="activity">
              Activity, last 24 h
            </CardTitle>
            <ActivityLegend withRaid />
          </div>
          <ActivityChart messages={SAMPLE_MESSAGES} voice={SAMPLE_VOICE} raid={SAMPLE_RAID} />
        </Card>

        <Card lock="phaethon" labelledBy="h-ph" className="flex-[2_1_360px] gap-3 px-5 py-[18px]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <CardTitle id="h-ph" icon="eye">
                Phaethon Watchlist
              </CardTitle>
              <span className="text-[12.5px] text-muted">Last 3 flagged accounts, 2 online now</span>
            </div>
            <Link href="/phaethon" className="flex min-h-9 items-center text-[13px] font-semibold text-fg-soft no-underline hover:text-accent">
              Open
            </Link>
          </div>
          <div className="flex flex-1 flex-col gap-2.5">
            {SAMPLE_FLAGGED.map((account) => (
              <div key={account.name} className="flex flex-1 items-center gap-3 rounded-xl border border-line bg-raised px-3.5 py-2.5">
                <Avatar size={36} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-semibold">{account.name}</span>
                  <span className="text-[12.5px] text-muted">
                    {account.reason} • {account.when}
                  </span>
                </div>
                <Link
                  href="/phaethon"
                  aria-label={`Review ${account.name}`}
                  className="box-border flex min-h-11 flex-none items-center rounded-[10px] border border-line-strong px-4 text-[13px] font-semibold text-fg no-underline hover:border-accent hover:bg-[#1f1a1a]"
                >
                  Review
                </Link>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="flex flex-1 flex-wrap gap-4">
        <Card lock="stats" labelledBy="h-log" className="flex-[3_1_520px] gap-1.5 px-5 pt-[18px] pb-2">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <CardTitle id="h-log" icon="list">
              Last Actions &amp; Logs
            </CardTitle>
            <span className="flex items-center gap-[7px] text-[12.5px] text-muted">
              <span aria-hidden="true" className="size-[7px] rounded-full bg-success" />
              Latest audit events
            </span>
          </div>
          <ul className="m-0 flex flex-1 list-none flex-col p-0">
            {SAMPLE_LOGS.map((log) => (
              <li key={log.text} className="flex min-h-11 flex-1 items-center gap-3.5 border-t border-divider">
                <span className="box-border w-[78px] flex-none rounded-lg border border-line-strong py-[3px] text-center text-xs font-semibold text-fg-soft">
                  {log.tag}
                </span>
                <span className="min-w-0 flex-1 text-[13.5px] text-fg-strong">{log.text}</span>
                <span className="flex-none text-xs text-muted">{log.when}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card lock="settings" labelledBy="h-qt" className="flex-[2_1_360px] gap-1.5 px-5 pt-[18px] pb-2">
          <CardTitle id="h-qt" icon="sliders">
            Quick Toggles
          </CardTitle>
          <div className="flex flex-1 flex-col">
            {TOGGLE_DEFS.map((toggle) => (
              <div key={toggle.id} className="flex min-h-[52px] flex-1 items-center justify-between gap-3 border-t border-divider">
                <span className="text-[14.5px] font-semibold">{toggle.label}</span>
                <Switch
                  label={toggle.label}
                  checked={toggles[toggle.id]}
                  onChange={(next) => setToggles((current) => ({ ...current, [toggle.id]: next }))}
                />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

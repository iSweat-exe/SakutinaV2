"use client";

import Link from "next/link";
import { useGuildHref } from "@/lib/guild-href";
import { useState } from "react";
import { ActivityChart, ActivityLegend } from "@/components/charts/activity-chart";
import { GuildAvatar } from "@/components/servers/guild-avatar";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Locked } from "@/components/ui/locked";
import { StatCard } from "@/components/ui/stat-card";
import { Switch } from "@/components/ui/switch";
import { short } from "@/lib/format";
import type { Overview } from "@/lib/panel-db/schema";
import { TOGGLE_DEFS, type ToggleId } from "./sample";

type Toggles = Record<ToggleId, boolean>;

/** A moderation action, already worded and timed on the server. */
export type LogLine = Readonly<{
  id: string;
  tag: string;
  verb: string;
  /** The member concerned, with their picture; null for an action about no one in particular. */
  member: Readonly<{ name: string; avatarUrl: string | null }> | null;
  /** What follows the member ("for 10 min · spam · by Mika"), connector included. */
  suffix: string;
  when: string;
}>;

/** The Phaethon card: how many accounts are flagged, and the riskiest ones. */
export type Flagged = Readonly<{
  count: number;
  accounts: ReadonlyArray<Readonly<{ id: string; name: string; avatarUrl: string | null; reason: string; score: number }>>;
}>;

type Props = Readonly<{
  overview: Overview;
  logs: ReadonlyArray<LogLine>;
  flagged: Flagged;
}>;

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
 * Everything under the status header. Figures, the activity chart and the log come
 * from the database (`panel_overview`, `panel_recent_audit`); the rest is behind a
 * lock until its data exists (see lib/features.ts).
 */
export function DashboardBody({ overview, logs, flagged }: Props) {
  const guildHref = useGuildHref();
  const [toggles, setToggles] = useState<Toggles>({ casino: true, antiraid: true, phaethon: true, profiling: false });
  const security = securityOf(toggles);

  return (
    <>
      <div className="grid gap-4 max-lg:grid-cols-2 max-sm:gap-3 lg:[grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))]">
        <Locked feature="settings" className="flex flex-col rounded-2xl max-lg:col-span-2">
          <StatCard
            roomy
            className="flex-1"
            label="Security"
            value={
              <span className="flex items-center gap-2" style={{ color: security.color }}>
                <Icon name="shield" size={22} strokeWidth={1.9} />
                {security.label}
              </span>
            }
            sub={security.sub}
          />
        </Locked>
        <StatCard roomy label="Messages" value={short(overview.messages24h)} sub="Last 24 hours" />
        <StatCard roomy label="Coins in circulation" value={short(overview.coinsTotal)} sub="Wallets and banks" />
        <StatCard
          roomy
          label="Active members"
          value={short(overview.activeMembers24h)}
          sub={`Out of ${short(overview.members)}`}
        />
      </div>

      <div className="flex flex-1 flex-wrap gap-4">
        <Card labelledBy="h-act" className="flex-[3_1_520px] gap-3 px-5 pt-[18px] pb-3.5">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <CardTitle id="h-act" icon="activity">
              Activity, last 24 h <span className="text-sm font-normal text-muted">UTC</span>
            </CardTitle>
            <ActivityLegend withVoice withRaid={false} />
          </div>
          <ActivityChart
            messages={overview.hourly.map((slot) => slot.messages)}
            voice={overview.hourly.map((slot) => slot.voiceMinutes)}
            hours={overview.hourly.map((slot) => slot.hour)}
            times={overview.hourly.map((slot) => slot.at)}
          />
        </Card>

        <Card labelledBy="h-ph" className="flex-[2_1_360px] gap-3 px-5 py-[18px]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <CardTitle id="h-ph" icon="eye">
                Phaethon Watchlist
              </CardTitle>
              <span className="text-[12.5px] text-muted">
                {flagged.count === 0
                  ? "No flagged account"
                  : `${flagged.accounts.length === flagged.count ? "" : `Top ${flagged.accounts.length} of `}${flagged.count} flagged ${flagged.count === 1 ? "account" : "accounts"}`}
              </span>
            </div>
            <Link href={guildHref("phaethon")} className="flex min-h-9 items-center text-[13px] font-semibold text-fg-soft no-underline hover:text-accent">
              Open
            </Link>
          </div>
          <div className="flex flex-1 flex-col gap-2.5">
            {flagged.accounts.length === 0 ? (
              <p className="m-0 flex flex-1 items-center justify-center py-10 text-center text-sm text-muted">
                Every member looks ordinary right now.
              </p>
            ) : null}
            {flagged.accounts.map((account) => (
              <div key={account.id} className="flex flex-1 items-center gap-3 rounded-xl border border-line bg-raised px-3.5 py-2.5">
                <Avatar src={account.avatarUrl} size={36} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-semibold">{account.name}</span>
                  <span className="text-[12.5px] text-muted">
                    {account.reason} • Risk {account.score}
                  </span>
                </div>
                <Link
                  href={guildHref("phaethon")}
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
        <Card labelledBy="h-log" className="flex-[3_1_520px] gap-1.5 px-5 pt-[18px] pb-2">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <CardTitle id="h-log" icon="list">
              Last Actions &amp; Logs
            </CardTitle>
            <span className="flex items-center gap-[7px] text-[12.5px] text-muted">
              <span aria-hidden="true" className="size-[7px] rounded-full bg-success" />
              Latest audit events
            </span>
          </div>
          {logs.length === 0 ? (
            <p className="m-0 flex flex-1 items-center justify-center py-10 text-sm text-muted">
              No moderation action recorded yet.
            </p>
          ) : (
            <ul className="m-0 flex flex-1 list-none flex-col p-0">
              {logs.map((log) => (
                <li key={log.id} className="flex min-h-11 flex-1 items-center gap-3.5 border-t border-divider max-lg:flex-none max-sm:grid max-sm:grid-cols-[78px_1fr] max-sm:items-start max-sm:gap-x-3 max-sm:gap-y-0.5 max-sm:py-2.5">
                  <span className="box-border w-[78px] flex-none rounded-lg border border-line-strong py-[3px] text-center text-xs font-semibold text-fg-soft max-sm:row-span-2">
                    {log.tag}
                  </span>
                  {log.member ? (
                    <GuildAvatar name={log.member.name} iconUrl={log.member.avatarUrl} size={28} className="border border-[#55555a] bg-selected max-sm:hidden" />
                  ) : null}
                  <span className="min-w-0 flex-1 text-[13.5px] text-fg-strong max-sm:col-start-2">
                    {log.verb}
                    {log.member ? <strong className="font-semibold"> {log.member.name}</strong> : null}
                    {log.suffix}
                  </span>
                  <span className="flex-none text-xs text-muted max-sm:col-start-2">{log.when}</span>
                </li>
              ))}
            </ul>
          )}
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

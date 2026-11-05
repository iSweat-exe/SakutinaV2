"use client";

import { useState, useId, useTransition, type ReactNode } from "react";
import { saveEconomyRules } from "@/app/servers/[guildId]/balance/actions";
import { CirculationChart } from "@/components/charts/circulation-chart";
import { GuildAvatar } from "@/components/servers/guild-avatar";
import { Card, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { Stepper } from "@/components/ui/stepper";
import { memberAvatarUrl } from "@/lib/discord-guilds";
import type { Economy, EconomyRules } from "@/lib/panel-db/economy-schema";
import { RULE_LIMITS } from "@/lib/panel-db/economy-schema";
import type { IconName } from "@/lib/icons";
import { capitalize, compactAxis, dayShort, dayTitle, number } from "@/lib/format";

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

const MESSAGES = {
  forbidden: "Your Discord account cannot change this server's rules.",
  invalid: "One of the values is out of range. Check them and try again.",
  unavailable: "The rules could not be saved right now. Try again in a moment.",
} as const;

/** The four rules, saved together. The bot applies them within a minute. */
function EconomyRulesCard({ guildId, initial }: Readonly<{ guildId: string; initial: EconomyRules }>) {
  const [saved, setSaved] = useState(initial);
  const [currency, setCurrency] = useState(initial.currencyName);
  const [daily, setDaily] = useState(initial.dailyReward);
  const [start, setStart] = useState(initial.startingBalance);
  const [tax, setTax] = useState(initial.transferTaxPercent);
  const [pending, startSaving] = useTransition();
  const [notice, setNotice] = useState<Readonly<{ tone: "ok" | "error"; text: string }> | null>(null);
  const nameId = useId();
  const taxId = useId();

  const draft: EconomyRules = {
    currencyName: currency.trim(),
    dailyReward: daily,
    startingBalance: start,
    transferTaxPercent: tax,
  };
  const dirty =
    draft.currencyName !== saved.currencyName ||
    draft.dailyReward !== saved.dailyReward ||
    draft.startingBalance !== saved.startingBalance ||
    draft.transferTaxPercent !== saved.transferTaxPercent;
  const nameShown = draft.currencyName || saved.currencyName;
  const net = number(Math.round((1000 * (100 - tax)) / 100));

  function save() {
    setNotice(null);
    startSaving(async () => {
      const result = await saveEconomyRules(guildId, draft);

      if (result.ok) {
        setSaved(result.rules);
        setCurrency(result.rules.currencyName);
        setNotice({ tone: "ok", text: "Saved. The bot applies the new rules within a minute." });
      } else {
        setNotice({ tone: "error", text: MESSAGES[result.error] });
      }
    });
  }

  function reset() {
    setCurrency(saved.currencyName);
    setDaily(saved.dailyReward);
    setStart(saved.startingBalance);
    setTax(saved.transferTaxPercent);
    setNotice(null);
  }

  return (
    <Card labelledBy="h-rules" className="gap-4 px-5 pt-[18px] pb-[22px]">
      <CardTitle id="h-rules">Economy rules</CardTitle>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr))]">
        <RuleTile icon="coin" title="Currency" subtitle="What members see on their balance">
          <div className="box-border flex h-11 items-center gap-2.5 rounded-xl border border-line bg-bg px-3 focus-within:border-accent">
            <label htmlFor={nameId} className="sr-clip">
              Currency name
            </label>
            <input
              id={nameId}
              className="bare text-left"
              type="text"
              maxLength={RULE_LIMITS.currencyName.max}
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
            />
          </div>
          <span className="text-[12.5px] text-muted">
            Shown as <span className="font-semibold text-fg">1,250 {nameShown}</span>
          </span>
        </RuleTile>

        <RuleTile icon="clock" title="Daily reward" subtitle="Claimed once every 20 hours, plus a streak bonus">
          <Stepper label="daily reward" value={daily} step={50} max={RULE_LIMITS.dailyReward.max} unit="per day" onChange={setDaily} />
        </RuleTile>

        <RuleTile icon="card" title="Starting balance" subtitle="Given once to every new member">
          <Stepper label="starting balance" value={start} step={100} max={RULE_LIMITS.startingBalance.max} unit="on join" onChange={setStart} />
        </RuleTile>

        <RuleTile icon="percent" title="Transfer tax" subtitle="Kept by the server on every /economy pay">
          <div className="flex items-baseline justify-between">
            <label htmlFor={taxId} className="text-[13px] text-muted">
              Rate
            </label>
            <span className="font-display text-[28px] font-bold text-accent">{tax}%</span>
          </div>
          <input id={taxId} type="range" min={0} max={RULE_LIMITS.transferTaxPercent.max} value={tax} onChange={(event) => setTax(Number(event.target.value))} />
          <span className="text-[12.5px] text-muted">
            Sending 1,000 delivers <span className="font-semibold text-fg">{net}</span>
          </span>
        </RuleTile>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || pending || !draft.currencyName}
          className="min-h-11 cursor-pointer rounded-xl border border-transparent bg-accent px-5 text-sm font-semibold text-on-accent hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {pending ? "Saving…" : "Save rules"}
        </button>
        {dirty && !pending ? (
          <button
            type="button"
            onClick={reset}
            className="min-h-11 cursor-pointer rounded-xl border border-line-strong bg-transparent px-4 text-sm font-semibold text-fg-soft hover:border-accent"
          >
            Discard changes
          </button>
        ) : null}
        <span role="status" className={`text-[13px] ${notice?.tone === "error" ? "text-danger" : "text-muted"}`}>
          {notice?.text ?? ""}
        </span>
      </div>
    </Card>
  );
}

/** The server's economy as the database reports it, then its rules. */
export function BalanceView({ guildId, economy }: Readonly<{ guildId: string; economy: Economy }>) {
  const biggest = economy.top[0]?.coins ?? 1;
  const lastIndex = economy.circulation.length - 1;
  const unit = economy.rules.currencyName;

  return (
    <>
      <StatGrid>
        <StatCard label={`Total ${unit.toLowerCase()}`} value={compactAxis(economy.coinsTotal)} sub={sinceYesterday(economy.circulation)} />
        <StatCard
          label="Average balance"
          value={number(economy.average)}
          sub={`Across ${number(economy.holders)} ${economy.holders === 1 ? "member" : "members"} with a balance`}
        />
        <StatCard label="Earned, last 24 h" value={number(economy.earned24h)} sub="Rewards and payments received" />
        <StatCard label="Spent, last 24 h" value={number(economy.spent24h)} sub="Spent and sent by members" />
      </StatGrid>

      <div className="flex flex-wrap gap-4">
        <Card labelledBy="h-circ" className="flex-[3_1_480px] gap-2.5 px-5 pt-[18px] pb-3.5">
          <CardTitle id="h-circ">{capitalize(unit)} in circulation, last {economy.circulation.length} days</CardTitle>
          <CirculationChart
            values={economy.circulation.map((point) => point.coins)}
            days={economy.circulation.map((point, i) => (i === lastIndex ? "Today" : dayShort(point.day)))}
            titles={economy.circulation.map((point, i) => (i === lastIndex ? `Today, ${dayTitle(point.day)} (now)` : `${dayTitle(point.day)}, end of day`))}
            unit={unit}
          />
        </Card>

        <Card labelledBy="h-top" className="flex-[2_1_340px] gap-3.5 px-5 py-[18px]">
          <CardTitle id="h-top">Top holders</CardTitle>
          {economy.top.length === 0 ? (
            <p className="m-0 text-sm text-muted">Nobody holds {unit.toLowerCase()} yet. Balances appear once members use /economy.</p>
          ) : (
            <ol className="m-0 flex list-none flex-col gap-3 p-0">
              {economy.top.map((holder, index) => {
                const name = holder.name ?? `Member …${holder.memberId.slice(-6)}`;

                return (
                  <li key={holder.memberId} className="flex items-center gap-3">
                    <span className="w-5 flex-none text-[13px] font-semibold text-muted">{index + 1}</span>
                    <GuildAvatar
                      name={name}
                      iconUrl={memberAvatarUrl(holder.memberId, holder.avatar)}
                      size={32}
                      className="border border-[#55555a] bg-selected"
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <div className="flex justify-between gap-2">
                        <span className="truncate text-sm font-semibold" title={`Discord ID ${holder.memberId}`}>
                          {name}
                        </span>
                        <span className="flex-none text-[13px] text-fg-dim">{number(holder.coins)}</span>
                      </div>
                      <span aria-hidden="true" className="h-[5px] overflow-hidden rounded-[3px] bg-[#2a2a2d]">
                        <span className="block h-full bg-accent" style={{ width: `${Math.round((holder.coins / biggest) * 100)}%` }} />
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      </div>

      <EconomyRulesCard guildId={guildId} initial={economy.rules} />
    </>
  );
}

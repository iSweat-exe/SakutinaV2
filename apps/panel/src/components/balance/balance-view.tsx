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
import { TreasuryCard } from "@/components/balance/treasury-card";
import type { Economy, EconomyRules } from "@/lib/panel-db/economy-schema";
import type { Treasury } from "@/lib/panel-db/treasury-schema";
import { RULE_LIMITS } from "@/lib/panel-db/economy-schema";
import type { IconName } from "@/lib/icons";
import { capitalize, dayShort, dayTitle, number, short } from "@/lib/format";

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
    return `+${short(today)} since yesterday`;
  }

  const percent = ((today - yesterday) / yesterday) * 100;

  return `${percent > 0 ? "+" : ""}${percent.toFixed(Math.abs(percent) < 10 ? 1 : 0)}% since yesterday`;
}

/**
 * One rule: a heading, its control and a hint. The tile takes three rows of the shared grid (subgrid), so the
 * headings, the controls and the hints of tiles side by side start at the same height, whatever the text.
 */
function RuleTile({
  icon,
  title,
  subtitle,
  control,
  hint,
}: Readonly<{ icon: IconName; title: string; subtitle: string; control: ReactNode; hint: ReactNode }>) {
  return (
    <div className="box-border grid row-span-3 grid-rows-subgrid gap-y-3.5 rounded-2xl border border-line bg-raised p-[18px] hover:border-line-strong">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex size-10 flex-none items-center justify-center rounded-xl border border-line-strong bg-selected">
          <Icon name={icon} size={20} className="text-accent" />
        </span>
        <div className="flex min-w-0 flex-col gap-px">
          <span className="font-display text-[17px] font-bold">{title}</span>
          <span className="text-[12.5px] leading-snug text-muted">{subtitle}</span>
        </div>
      </div>
      <div className="flex min-w-0 items-center">{control}</div>
      <div className="text-[12.5px] leading-snug text-muted">{hint}</div>
    </div>
  );
}

/** A rate in tenths of a percent on a slider, shown as a percentage ("Off" at zero). */
function PermilleSlider({
  label,
  value,
  max,
  onChange,
}: Readonly<{ label: string; value: number; max: number; onChange: (value: number) => void }>) {
  const id = useId();

  return (
    <div className="flex h-11 w-full items-center gap-3">
      <label htmlFor={id} className="sr-clip">
        {label}
      </label>
      <input id={id} className="min-w-0 flex-1" type="range" min={0} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <span className="w-14 flex-none text-right font-display text-xl font-bold text-accent tabular-nums">
        {value === 0 ? "Off" : `${(value / 10).toFixed(1)}%`}
      </span>
    </div>
  );
}

const MESSAGES = {
  forbidden: "Your Discord account cannot change this server's rules.",
  invalid: "One of the values is out of range. Check them and try again.",
  unavailable: "The rules could not be saved right now. Try again in a moment.",
} as const;

/** The seven rules, saved together. The bot applies them within a minute. */
function EconomyRulesCard({ guildId, initial }: Readonly<{ guildId: string; initial: EconomyRules }>) {
  const [saved, setSaved] = useState(initial);
  const [currency, setCurrency] = useState(initial.currencyName);
  const [salary, setSalary] = useState(initial.salaryBudgetPermille);
  const [wealth, setWealth] = useState(initial.wealthTaxPermille);
  const [idle, setIdle] = useState(initial.idleTaxPermille);
  const [start, setStart] = useState(initial.startingBalance);
  const [tax, setTax] = useState(initial.transferTaxPercent);
  const [interest, setInterest] = useState(initial.bankInterestPermille);
  const [pending, startSaving] = useTransition();
  const [notice, setNotice] = useState<Readonly<{ tone: "ok" | "error"; text: string }> | null>(null);
  const nameId = useId();
  const taxId = useId();
  const interestId = useId();

  const draft: EconomyRules = {
    currencyName: currency.trim(),
    salaryBudgetPermille: salary,
    startingBalance: start,
    transferTaxPercent: tax,
    bankInterestPermille: interest,
    wealthTaxPermille: wealth,
    idleTaxPermille: idle,
  };
  const dirty =
    draft.currencyName !== saved.currencyName ||
    draft.salaryBudgetPermille !== saved.salaryBudgetPermille ||
    draft.wealthTaxPermille !== saved.wealthTaxPermille ||
    draft.idleTaxPermille !== saved.idleTaxPermille ||
    draft.startingBalance !== saved.startingBalance ||
    draft.transferTaxPercent !== saved.transferTaxPercent ||
    draft.bankInterestPermille !== saved.bankInterestPermille;
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
    setSalary(saved.salaryBudgetPermille);
    setWealth(saved.wealthTaxPermille);
    setIdle(saved.idleTaxPermille);
    setStart(saved.startingBalance);
    setTax(saved.transferTaxPercent);
    setInterest(saved.bankInterestPermille);
    setNotice(null);
  }

  return (
    <Card labelledBy="h-rules" className="gap-4 px-5 pt-[18px] pb-[22px]">
      <CardTitle id="h-rules">Economy rules</CardTitle>
      <div className="grid gap-x-4 gap-y-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr))]">
        <RuleTile
          icon="coin"
          title="Currency"
          subtitle="What members see on their balance"
          control={
            <div className="box-border flex h-11 w-full items-center rounded-xl border border-line bg-bg px-3 focus-within:border-accent">
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
          }
          hint={
            <>
              Shown as <span className="font-semibold text-fg">1,250 {nameShown}</span>
            </>
          }
        />

        <RuleTile
          icon="clock"
          title="Salary budget"
          subtitle="Share of the reserve paid out each day by /economy work and /economy daily"
          control={<PermilleSlider label="Daily salary budget" value={salary} max={RULE_LIMITS.salaryBudgetPermille.max} onChange={setSalary} />}
          hint={
            salary === 0 ? (
              "Off: work and daily pay nothing."
            ) : (
              <>
                A 900,000 reserve pays <span className="font-semibold text-fg">{number(900 * salary)}</span> a day, split between active members.
              </>
            )
          }
        />

        <RuleTile
          icon="card"
          title="Starting balance"
          subtitle="Paid by the reserve to every new member"
          control={<Stepper label="starting balance" value={start} step={100} max={RULE_LIMITS.startingBalance.max} unit="on join" onChange={setStart} />}
          hint="Only once per member, even if they leave and come back."
        />

        <RuleTile
          icon="percent"
          title="Transfer tax"
          subtitle="Goes to the reserve on every /economy pay"
          control={
            <div className="flex h-11 w-full items-center gap-3">
              <label htmlFor={taxId} className="sr-clip">
                Transfer tax rate
              </label>
              <input
                id={taxId}
                className="min-w-0 flex-1"
                type="range"
                min={0}
                max={RULE_LIMITS.transferTaxPercent.max}
                value={tax}
                onChange={(event) => setTax(Number(event.target.value))}
              />
              <span className="w-12 flex-none text-right font-display text-xl font-bold text-accent tabular-nums">{tax}%</span>
            </div>
          }
          hint={
            <>
              Sending 1,000 delivers <span className="font-semibold text-fg">{net}</span>
            </>
          }
        />

        <RuleTile
          icon="coin"
          title="Bank interest"
          subtitle="Paid every day out of the reserve"
          control={
            <div className="flex h-11 w-full items-center gap-3">
              <label htmlFor={interestId} className="sr-clip">
                Daily bank interest rate
              </label>
              <input
                id={interestId}
                className="min-w-0 flex-1"
                type="range"
                min={0}
                max={RULE_LIMITS.bankInterestPermille.max}
                value={interest}
                onChange={(event) => setInterest(Number(event.target.value))}
              />
              <span className="w-14 flex-none text-right font-display text-xl font-bold text-accent tabular-nums">
                {interest === 0 ? "Off" : `${(interest / 10).toFixed(1)}%`}
              </span>
            </div>
          }
          hint={
            interest === 0 ? (
              "Off: coins in the bank earn nothing."
            ) : (
              <>
                10,000 kept in the bank for a day earns <span className="font-semibold text-fg">{number(10 * interest)}</span>. Never more than the reserve can pay.
              </>
            )
          }
        />

        <RuleTile
          icon="percent"
          title="Wealth tax"
          subtitle="Every Sunday, on what an active member holds above 3 times the median balance"
          control={<PermilleSlider label="Weekly wealth tax rate" value={wealth} max={RULE_LIMITS.wealthTaxPermille.max} onChange={setWealth} />}
          hint="Never below a 10,000 threshold. The tax goes back to the reserve."
        />

        <RuleTile
          icon="percent"
          title="Idle accounts tax"
          subtitle="Same tax, for accounts with no activity for 14 days"
          control={<PermilleSlider label="Weekly idle accounts tax rate" value={idle} max={RULE_LIMITS.idleTaxPermille.max} onChange={setIdle} />}
          hint="Puts sleeping coins back into circulation."
        />
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
export function BalanceView({ guildId, economy, treasury }: Readonly<{ guildId: string; economy: Economy; treasury: Treasury }>) {
  const biggest = economy.top[0]?.coins ?? 1;
  const lastIndex = economy.circulation.length - 1;
  const unit = economy.rules.currencyName;

  return (
    <>
      <StatGrid>
        <StatCard label={`Total ${unit.toLowerCase()}`} value={short(economy.coinsTotal)} sub={sinceYesterday(economy.circulation)} />
        <StatCard
          label="Average balance"
          value={short(economy.average)}
          sub={`Across ${short(economy.holders)} ${economy.holders === 1 ? "member" : "members"} with a balance`}
        />
        <StatCard label="Earned, last 24 h" value={short(economy.earned24h)} sub="Rewards and payments received" />
        <StatCard label="Spent, last 24 h" value={short(economy.spent24h)} sub="Spent and sent by members" />
      </StatGrid>

      <StatGrid>
        <StatCard label="Reserve" value={short(economy.pools.reserve)} sub="Pays salaries and interest, collects taxes" />
        <StatCard label="Casino account" value={short(economy.pools.casino)} sub="Pays winnings, sets the share price" />
        <StatCard label="Jackpot" value={short(economy.pools.jackpot)} sub="5% of casino losses, won with three 7s" />
        <StatCard label="Money supply" value={short(economy.pools.moneySupply)} sub="Launch grant plus one grant per new member" />
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
                        <span className="flex-none text-[13px] text-fg-dim" title={`${number(holder.coins)} ${unit}`}>
                          {short(holder.coins)}
                        </span>
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

      <TreasuryCard guildId={guildId} treasury={treasury} unit={unit} />

      <EconomyRulesCard guildId={guildId} initial={economy.rules} />
    </>
  );
}

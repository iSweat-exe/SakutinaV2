"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { askRaid, saveAntiRaid, type ActionError } from "@/app/servers/[guildId]/anti-raid/actions";
import { Card, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Icon } from "@/components/ui/icon";
import { MasterSwitch, PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { SettingRow } from "@/components/ui/setting-row";
import { Slider } from "@/components/ui/slider";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";
import { number } from "@/lib/format";
import { LIMITS, RAID_ACTIONS, type AntiRaid, type RaidAction, type RaidRecord, type SettingsPatch } from "@/lib/panel-db/anti-raid-schema";

const ACTION_LABELS: Record<RaidAction, string> = { watch: "Watch only", quarantine: "Quarantine", kick: "Kick", ban: "Ban" };

const ACTION_HINTS: Record<RaidAction, string> = {
  watch: "Observation mode: raids are detected, logged and reported, but nobody is touched and nothing is locked.",
  quarantine: "Accounts that join during a raid are timed out for 24 hours. Lift any of them from the Moderation page.",
  kick: "Accounts that join during a raid are removed from the server. They can join again with an invite.",
  ban: "Accounts that join during a raid are banned, and their messages of the last hour are deleted.",
};

/** Discord permissions the bot needs for each part of the response. */
const PERMISSIONS: Record<RaidAction, string> = {
  watch: "",
  quarantine: "Timeout Members",
  kick: "Kick Members",
  ban: "Ban Members",
};

const ERRORS: Record<ActionError, string> = {
  forbidden: "You no longer manage this server.",
  invalid: "That change was refused. Reload the page and try again.",
  unavailable: "The change could not be saved. Try again in a moment.",
};

/** A slider is saved once the admin stops dragging it. */
const SLIDER_SAVE_DELAY_MS = 600;

type Notice = Readonly<{ tone: "ok" | "error"; text: string }>;

/** "Nov 5, 21:14 UTC": read in UTC so the server and the browser render the same text. */
function when(iso: string): string {
  return `${new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" })} UTC`;
}

/** "45 s", "6 min", "2 h 10 min". */
function span(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1_000));

  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ""}`;
}

const plural = (count: number, word: string) => `${number(count)} ${word}${count === 1 ? "" : "s"}`;

function JoinsPerMinute({ minutes, threshold }: Readonly<{ minutes: ReadonlyArray<number>; threshold: number }>) {
  // A quiet server still shows its few joins: the scale starts at 5 per minute.
  const max = Math.max(...minutes, 5);

  return (
    <svg role="img" aria-label={`Joins per minute over the last 10 minutes: ${minutes.join(", ")}`} viewBox="0 0 200 36" width="100%" className="block h-9">
      {minutes.map((count, i) => {
        const h = Math.max(2, Math.round((count / max) * 34));

        return <rect key={i} x={i * 20 + 2} y={36 - h} width="16" height={h} rx="3" className={count >= threshold ? "fill-danger" : count > 0 ? "fill-accent" : "fill-line"} />;
      })}
    </svg>
  );
}

function ResponseSummary({ raid }: Readonly<{ raid: Pick<RaidRecord, "action" | "actioned" | "failed"> }>) {
  if (raid.action === "watch") {
    return <>Watch only</>;
  }

  return (
    <span>
      {ACTION_LABELS[raid.action]} · {number(raid.actioned)}
      {raid.failed > 0 ? <span className="text-warning"> · {plural(raid.failed, "failure")}</span> : null}
    </span>
  );
}

/** Anti-Raid: settings saved to the database (the bot applies them within 10 s), live state, lockdown and history. */
export function AntiRaidView({ guildId, antiRaid }: Readonly<{ guildId: string; antiRaid: AntiRaid }>) {
  const router = useRouter();
  const [data, setData] = useState(antiRaid);
  const [seen, setSeen] = useState(antiRaid.generatedAt);
  /** Changes not saved yet: shown over the saved settings so the controls answer at once. */
  const [draft, setDraft] = useState<SettingsPatch>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [requesting, startRequest] = useTransition();
  const queued = useRef<SettingsPatch>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fresh data from the server (refresh, save): it replaces what is shown.
  if (antiRaid.generatedAt !== seen) {
    setSeen(antiRaid.generatedAt);
    setData(antiRaid);
  }

  const settings = { ...data.settings, ...draft };
  const active = data.active;
  const pending = data.pending;

  // Live page: every few seconds while a raid or a request is under way, otherwise every 20 s.
  useEffect(() => {
    const id = setInterval(() => router.refresh(), active || pending ? 3_000 : 20_000);
    return () => clearInterval(id);
  }, [router, active, pending]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function flush() {
    const patch = queued.current;
    queued.current = {};
    timer.current = null;

    if (Object.keys(patch).length === 0) {
      return;
    }

    const result = await saveAntiRaid(guildId, patch);

    setDraft((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch) as (keyof SettingsPatch)[]) {
        // A newer change to the same setting is still waiting: keep it.
        if (next[key] === patch[key]) delete next[key];
      }
      return next;
    });

    if (result.ok) {
      setData(result.antiRaid);
      setNotice(null);
    } else {
      setNotice({ tone: "error", text: ERRORS[result.error] });
    }
  }

  function change(patch: SettingsPatch, delay = 0) {
    setDraft((current) => ({ ...current, ...patch }));
    queued.current = { ...queued.current, ...patch };

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), delay);
  }

  function request(action: "start" | "end") {
    setConfirming(false);
    setNotice(null);
    startRequest(async () => {
      const result = await askRaid(guildId, action);

      if (result.ok) {
        setNotice({ tone: "ok", text: action === "start" ? "Lockdown requested. The bot locks the server within seconds." : "The bot is ending the raid and restoring every channel." });
        router.refresh();
      } else {
        setNotice({ tone: "error", text: result.error === "invalid" ? (action === "start" ? "A raid is already in progress." : "There is no raid to end.") : ERRORS[result.error] });
      }
    });
  }

  const now = Date.parse(data.generatedAt);
  const status = active
    ? { label: "Raid in progress", className: "text-danger", icon: "shield" as const }
    : settings.enabled
      ? { label: "No raid detected", className: "text-success", icon: "check" as const }
      : { label: "Not watching", className: "text-warning", icon: "eye" as const };
  const peak = Math.max(...data.joinsPerMinute);
  const needs = [
    settings.action !== "watch" ? PERMISSIONS[settings.action] : null,
    settings.lockChannels ? "Manage Roles (on every channel)" : null,
    settings.raiseVerification ? "Manage Server" : null,
  ].filter(Boolean);

  return (
    <>
      <PageHeader
        title="Anti-Raid"
        description="Detect coordinated joins and stop them before they reach your members."
        aside={
          <MasterSwitch label={settings.enabled ? "Protection on" : "Protection off"}>
            <Switch label="Anti-Raid protection" checked={settings.enabled} onChange={(enabled) => change({ enabled })} />
          </MasterSwitch>
        }
      />

      {notice ? (
        <p role="status" className={cn("m-0 text-sm", notice.tone === "error" ? "text-danger" : "text-success")}>
          {notice.text}
        </p>
      ) : null}

      <Card label={active ? "Raid in progress" : "Lockdown"} className={cn("gap-3 px-5 py-[18px]", active && "border-danger")}>
        {active ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <h2 className="m-0 flex items-center gap-2.5 font-display text-xl font-bold text-danger">
                  <Icon name="shield" size={20} />
                  {active.trigger === "manual" ? `Server locked down by ${active.startedByName ?? "an admin"}` : "Raid detected"}
                </h2>
                <span className="text-[13.5px] text-muted">
                  Since {when(active.startedAt)} · {span(now - Date.parse(active.startedAt))} ago
                  {active.trigger === "burst" ? " · ends by itself after 2 minutes without a join" : " · lasts until you end it"}
                </span>
              </div>
              <button
                type="button"
                disabled={requesting || pending?.action === "end"}
                onClick={() => request("end")}
                className="min-h-11 cursor-pointer rounded-xl border border-transparent bg-accent px-5 text-sm font-semibold text-on-accent hover:brightness-110 disabled:cursor-wait disabled:opacity-55"
              >
                {pending?.action === "end" ? "Ending the raid…" : "End raid and restore"}
              </button>
            </div>
            <dl className="m-0 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(150px,100%),1fr))]">
              {[
                ["Joins", number(active.joins)],
                ["Response", active.action === "watch" ? "Watch only" : `${ACTION_LABELS[active.action]} · ${number(active.actioned)}`],
                ["Channels locked", number(active.lockedChannels)],
                ["Verification", active.verificationRaised ? "Raised" : "Unchanged"],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-col gap-0.5 rounded-xl border border-line bg-raised px-3.5 py-2.5">
                  <dt className="text-[12px] text-muted">{label}</dt>
                  <dd className="m-0 text-[15px] font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
            {active.failed > 0 ? (
              <p className="m-0 text-[13px] text-warning">
                The bot could not act on {plural(active.failed, "account")}: check that its role is above theirs and that it has {PERMISSIONS[active.action] || "the needed permissions"}.
              </p>
            ) : null}
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex max-w-[62ch] flex-col gap-1">
              <h2 className="m-0 flex items-center gap-2.5 font-display text-xl font-bold">
                <Icon name="lock" size={20} className="text-fg-soft" />
                Lockdown
              </h2>
              <span className="text-[13.5px] text-muted">
                Close every channel to @everyone now and treat newcomers as raiders, even with protection off. Each channel is saved
                first and restored exactly when you end it. Also available as <code>/server lockdown</code>.
              </span>
            </div>
            {pending?.action === "start" ? (
              <span role="status" className="text-sm font-semibold text-muted">
                Waiting for the bot…
              </span>
            ) : confirming ? (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setConfirming(false)} className="min-h-11 cursor-pointer rounded-xl border border-line-strong bg-transparent px-4 text-sm font-semibold text-fg-soft hover:border-accent">
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={requesting}
                  onClick={() => request("start")}
                  className="min-h-11 cursor-pointer rounded-xl border border-transparent bg-accent px-5 text-sm font-semibold text-on-accent hover:brightness-110 disabled:cursor-wait disabled:opacity-55"
                >
                  Lock the server
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirming(true)} className="min-h-11 cursor-pointer rounded-xl border border-line-strong bg-transparent px-5 text-sm font-semibold text-fg hover:border-accent">
                Lock down now
              </button>
            )}
          </div>
        )}
        {data.lastFailure ? (
          <p className="m-0 text-[13px] text-warning">
            The last {data.lastFailure.action === "start" ? "lockdown" : "end of raid"} request failed at {when(data.lastFailure.at)}
            {data.lastFailure.error ? `: ${data.lastFailure.error}` : "."}
          </p>
        ) : null}
      </Card>

      <StatGrid min={240}>
        <StatCard
          label="Raid status"
          valueClassName="!text-2xl"
          value={
            <span className={cn("flex items-center gap-2", status.className)}>
              <Icon name={status.icon} size={20} strokeWidth={1.9} />
              {status.label}
            </span>
          }
          sub={settings.enabled ? `${ACTION_LABELS[settings.action]} on detection` : "Turn protection on to detect raids"}
        />
        <StatCard
          label="Joins, last 10 min"
          value={number(data.joins10m)}
          sub={
            <span className="flex flex-col gap-1.5">
              <JoinsPerMinute minutes={data.joinsPerMinute} threshold={settings.joinThreshold} />
              <span>
                {data.youngJoins10m > 0 ? `${plural(data.youngJoins10m, "young account")} · ` : ""}
                {peak === 0 ? "Nobody joined" : `Busiest minute: ${plural(peak, "join")}`}
              </span>
            </span>
          }
        />
        <StatCard label="Raids, last 30 days" value={number(data.raids30d)} sub={data.history[0] ? `Last one ${when(data.history[0].startedAt)}` : "None so far"} />
      </StatGrid>

      <div className="flex flex-wrap gap-4">
        <Card labelledBy="h-det" className="flex-[1_1_420px] gap-[18px] px-5 py-[18px]">
          <CardTitle id="h-det">Detection</CardTitle>
          <Slider
            label="Join burst"
            hint="Members joining within the window before a raid is declared"
            {...LIMITS.joinThreshold}
            value={settings.joinThreshold}
            shown={`${settings.joinThreshold} joins`}
            onChange={(joinThreshold) => change({ joinThreshold }, SLIDER_SAVE_DELAY_MS)}
          />
          <Slider
            label="Time window"
            hint="How long the burst is measured over"
            {...LIMITS.windowSeconds}
            value={settings.windowSeconds}
            shown={`${settings.windowSeconds} seconds`}
            onChange={(windowSeconds) => change({ windowSeconds }, SLIDER_SAVE_DELAY_MS)}
          />
          <Slider
            label="Minimum account age"
            hint="Younger accounts weigh double in the burst count"
            {...LIMITS.minAccountAgeDays}
            value={settings.minAccountAgeDays}
            shown={settings.minAccountAgeDays === 0 ? "Off" : `${settings.minAccountAgeDays} days`}
            onChange={(minAccountAgeDays) => change({ minAccountAgeDays }, SLIDER_SAVE_DELAY_MS)}
          />
          <p className="m-0 rounded-xl border border-line bg-raised px-3.5 py-2.5 text-[13px] leading-normal text-muted">
            A raid starts when {settings.joinThreshold} joins arrive within {settings.windowSeconds} seconds
            {settings.minAccountAgeDays > 0 ? `, accounts younger than ${settings.minAccountAgeDays} days counting twice` : ""}. It ends
            by itself after 2 minutes without a join.
          </p>
        </Card>

        <Card labelledBy="h-resp" className="flex-[1_1_420px] gap-3.5 px-5 py-[18px]">
          <CardTitle id="h-resp">Response</CardTitle>
          <div className="flex flex-col gap-2">
            <span id="seg-l" className="text-[14.5px] font-semibold">
              Action on suspected raiders
            </span>
            <Segmented
              labelledBy="seg-l"
              options={RAID_ACTIONS.map((value) => ({ value, label: ACTION_LABELS[value] }))}
              value={settings.action}
              onChange={(action) => change({ action })}
            />
            <span className="text-[12.5px] leading-normal text-muted">{ACTION_HINTS[settings.action]}</span>
          </div>
          <SettingRow label="Lock channels during a raid" description="Members cannot send messages until the raid ends; every channel is restored exactly">
            <Switch label="Lock channels during a raid" checked={settings.lockChannels} onChange={(lockChannels) => change({ lockChannels })} />
          </SettingRow>
          <SettingRow
            label="Alert admins"
            description={data.alertChannel ? "Post a message in the alert channel when a raid starts and ends" : "No alert channel is set for this server: alerts are only logged"}
          >
            <Switch label="Alert admins" checked={settings.alertAdmins} onChange={(alertAdmins) => change({ alertAdmins })} />
          </SettingRow>
          <SettingRow label="Raise verification level" description="Require a verified phone number while the raid lasts">
            <Switch label="Raise verification level" checked={settings.raiseVerification} onChange={(raiseVerification) => change({ raiseVerification })} />
          </SettingRow>
          {needs.length > 0 ? <p className="m-0 text-[12.5px] text-muted">The bot needs: {needs.join(", ")}.</p> : null}
        </Card>
      </div>

      <Card labelledBy="h-hist" className="gap-3 px-5 pt-[18px] pb-2">
        <CardTitle id="h-hist">Raid history</CardTitle>
        {data.history.length === 0 ? (
          <p className="m-0 pb-3 text-sm text-muted">No raid yet. Raids of the last year show up here.</p>
        ) : (
          <DataTable cellPadding={14} minWidth={760} head={["Detected", "Trigger", "Joins", "Action taken", "Channels", "Duration", "Ended by"]}>
            {data.history.map((raid) => (
              <tr key={raid.id}>
                <td>{when(raid.startedAt)}</td>
                <td>{raid.trigger === "manual" ? `Lockdown by ${raid.startedByName ?? "an admin"}` : `Burst in ${raid.windowSeconds} s`}</td>
                <td>{number(raid.joins)}</td>
                <td>
                  <ResponseSummary raid={raid} />
                </td>
                <td>{raid.lockedChannels > 0 ? `${number(raid.lockedChannels)} locked` : "—"}</td>
                <td>{span(Date.parse(raid.endedAt) - Date.parse(raid.startedAt))}</td>
                <td>{raid.endedBy ? (raid.endedByName ?? "An admin") : "Automatic"}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>
    </>
  );
}

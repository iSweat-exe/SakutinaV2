"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState, useTransition } from "react";
import { ban, review, type ActionError } from "@/app/servers/[guildId]/phaethon/actions";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardTitle } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/cn";
import { number } from "@/lib/format";
import { BAN_REASON_MAX, type Phaethon } from "@/lib/panel-db/phaethon-schema";
import { CATEGORIES, band, drawDossier, toEntity, type Entity, type Filter } from "./model";
import { EconomyPanel, EvidencePanel, FactorsPanel, HeatmapPanel, LinksPanel, RatePanel, RiskGauge } from "./panels";

const MESSAGES: Readonly<Record<ActionError, string>> = {
  forbidden: "Your Discord account cannot act on this server's members.",
  invalid: "This account cannot be changed from here: it may have left, or it is the owner or an administrator.",
  unavailable: "That could not be saved right now. Try again in a moment.",
};

type Notice = Readonly<{ tone: "ok" | "error"; text: string }>;

const BUTTON =
  "min-h-[46px] flex-[1_1_100px] cursor-pointer rounded-xl border text-[13.5px] font-semibold text-fg hover:border-accent hover:bg-[#1f1a1a] disabled:cursor-not-allowed disabled:opacity-60";

function Dossier({
  entity,
  serverMedian,
  pending,
  onWatch,
  onDismiss,
  onBan,
}: Readonly<{
  entity: Entity;
  serverMedian: number;
  pending: boolean;
  onWatch: () => void;
  onDismiss: () => void;
  onBan: (reason: string) => void;
}>) {
  const dossier = useMemo(() => drawDossier(entity, serverMedian), [entity, serverMedian]);
  const { label, color } = band(entity.score);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState(entity.banReason);
  const reasonId = useId();
  const watching = entity.review === "watch";
  const banLabel = entity.banStatus === "pending" ? "Ban requested…" : entity.banStatus === "failed" ? "Ban failed, try again" : "Ban account";

  return (
    <div className="flex min-w-0 flex-col gap-3.5">
      <section aria-labelledby="h-dos" className="flex flex-wrap items-center gap-x-[22px] gap-y-4 rounded-2xl border border-line bg-card px-5 py-4">
        <Avatar src={entity.avatarUrl} size={64} large />
        <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1.5">
          <h2 id="h-dos" className="m-0 font-display text-[26px] font-bold tracking-[-0.01em] break-words">
            {entity.name}
          </h2>
          <span className="font-mono text-xs text-muted">ID {entity.uid}</span>
          <span className="text-[13px] text-fg-dim">
            Created {entity.created} • Joined {entity.joined} • {entity.status}
          </span>
          <p className="m-0 mt-1 text-sm leading-[1.45] text-fg-strong">{entity.verdict}</p>
        </div>
        <RiskGauge name={entity.name} score={entity.score} color={color} band={label} confidence={entity.conf} />
      </section>

      <div className="flex flex-wrap items-stretch gap-3.5">
        <FactorsPanel entity={entity} color={color} />
        <EvidencePanel entity={entity} />
        {dossier.nodes.length > 0 ? <LinksPanel entity={entity} dossier={dossier} color={color} /> : null}
        <EconomyPanel entity={entity} color={color} />
        <HeatmapPanel entity={entity} dossier={dossier} />
        <RatePanel entity={entity} dossier={dossier} />
      </div>

      <section aria-label="Decision" className="flex flex-col gap-3 rounded-2xl border border-line bg-card px-[18px] py-3.5">
        {confirming ? (
          <form
            className="flex flex-col gap-2.5"
            onSubmit={(event) => {
              event.preventDefault();
              onBan(reason);
              setConfirming(false);
            }}
          >
            <label htmlFor={reasonId} className="text-[13px] font-semibold">
              Ban {entity.name}? Sakutina bans the account on Discord and logs it under your name.
            </label>
            <input
              id={reasonId}
              value={reason}
              maxLength={BAN_REASON_MAX}
              required
              onChange={(event) => setReason(event.target.value)}
              className="min-h-[44px] rounded-xl border border-line-strong bg-raised px-3 text-[13.5px] text-fg outline-none focus:border-accent"
            />
            <div className="flex flex-wrap gap-2.5">
              <button type="button" onClick={() => setConfirming(false)} className={cn(BUTTON, "border-line-strong bg-transparent")}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending || reason.trim().length === 0}
                className={cn(BUTTON, "border-accent bg-accent font-bold text-on-accent hover:bg-accent")}
              >
                Confirm ban
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap gap-2.5">
            <button type="button" disabled={pending} onClick={onDismiss} className={cn(BUTTON, "border-line-strong bg-transparent")}>
              Dismiss
            </button>
            <button
              type="button"
              aria-pressed={watching}
              disabled={pending}
              onClick={onWatch}
              className={cn(BUTTON, watching ? "border-accent bg-selected" : "border-line-strong bg-transparent")}
            >
              {watching ? "Watching" : "Watch"}
            </button>
            <button
              type="button"
              disabled={pending || entity.banStatus === "pending"}
              onClick={() => {
                setReason(entity.banReason);
                setConfirming(true);
              }}
              className={cn(BUTTON, "border-accent bg-accent font-bold text-on-accent hover:bg-accent")}
            >
              {banLabel}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

/** The server's watchlist as the database scores it, with the dossier of the selected account. */
export function PhaethonView({ guildId, phaethon }: Readonly<{ guildId: string; phaethon: Phaethon }>) {
  const router = useRouter();
  const now = Date.parse(phaethon.generatedAt);
  const [filter, setFilter] = useState<Filter>("All");
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pending, startAction] = useTransition();

  const entities = useMemo(() => phaethon.entries.map((entry) => toEntity(entry, now)), [phaethon.entries, now]);
  const countOf = (c: Filter) => (c === "All" ? entities.length : entities.filter((e) => e.cats.includes(c)).length);
  const view = entities.filter((e) => filter === "All" || e.cats.includes(filter));
  const current = view.find((e) => e.id === selected) ?? view[0];
  const clusters = entities.filter((e) => e.links.length >= 3).length;
  const waiting = entities.some((e) => e.banStatus === "pending");

  // The bot bans within seconds: look again until it has (the account then leaves the list).
  useEffect(() => {
    if (!waiting) {
      return;
    }

    const timer = setTimeout(() => router.refresh(), 3_000);

    return () => clearTimeout(timer);
  }, [waiting, router, phaethon.generatedAt]);

  function act(run: () => Promise<{ ok: boolean; error?: ActionError }>, done: string) {
    setNotice(null);
    startAction(async () => {
      const result = await run();

      if (result.ok) {
        setNotice({ tone: "ok", text: done });
        router.refresh();
      } else {
        setNotice({ tone: "error", text: MESSAGES[result.error ?? "unavailable"] });
      }
    });
  }

  const ticker = [
    ["Members tracked", number(phaethon.membersTracked)],
    ["Clusters", number(clusters)],
    ["Banned, 7 d", number(phaethon.banned7d)],
    ["False flags, 7 d", number(phaethon.dismissed7d)],
  ] as const;

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-x-7 gap-y-3">
        <div className="flex flex-wrap items-baseline gap-3.5">
          <h1 className="m-0 font-display text-[34px] leading-[1.1] font-bold tracking-[-0.02em]">Phaethon</h1>
          <span className="text-sm text-muted">Behavioral intelligence on every member of the server</span>
        </div>
        <dl className="m-0 flex flex-wrap gap-x-7 gap-y-2">
          {ticker.map(([label, value]) => (
            <div key={label} className="flex flex-col gap-px">
              <dt className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">{label}</dt>
              <dd className="m-0 font-mono text-[17px] font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      </header>

      <span role="status" className={cn("min-h-4 text-[13px]", notice?.tone === "error" ? "text-danger" : "text-muted")}>
        {notice?.text ?? ""}
      </span>

      <div className="flex flex-wrap items-start gap-3.5">
        <Card labelledBy="h-list" className="min-w-[280px] flex-[0_1_340px] gap-3 px-3.5 pt-4 pb-3.5">
          <div className="flex items-baseline justify-between px-1">
            <CardTitle id="h-list" size={19}>
              Watchlist
            </CardTitle>
            <span className="text-[11.5px] font-semibold tracking-[0.08em] text-muted uppercase">Risk score / 100</span>
          </div>
          <Segmented
            shape="pill"
            label="Filter by behavior"
            value={filter}
            onChange={setFilter}
            options={CATEGORIES.map((c) => ({ value: c, label: `${c} ${countOf(c)}` }))}
          />
          <div role="radiogroup" aria-labelledby="h-list" className="flex flex-col gap-2">
            {view.map((entity) => {
              const { color } = band(entity.score);
              const on = entity.id === current?.id;
              const delta = entity.delta > 0 ? `▲ +${entity.delta}` : entity.delta < 0 ? `▼ ${entity.delta}` : "— 0";
              const deltaColor = entity.delta > 0 ? "#ff8a80" : entity.delta < 0 ? "#6aa7ff" : "#a6a6ad";

              return (
                <button
                  key={entity.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setSelected(entity.id)}
                  className={cn(
                    "box-border flex w-full cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-left font-sans text-fg hover:border-line-hover",
                    on ? "border-accent bg-raised" : "border-line bg-transparent",
                  )}
                >
                  <span className="flex w-[52px] flex-none flex-col items-start gap-1">
                    <span className="font-mono text-2xl leading-none font-semibold" style={{ color }}>
                      {entity.score}
                    </span>
                    <span aria-hidden="true" className="h-1 w-full overflow-hidden rounded-sm bg-[#2a2a2d]">
                      <span className="block h-full" style={{ width: `${entity.score}%`, background: color }} />
                    </span>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-[5px]">
                    <span className="truncate text-sm font-semibold">
                      {entity.name}
                      {entity.review === "watch" ? <span className="ml-1.5 text-[11.5px] font-normal text-muted">Watching</span> : null}
                    </span>
                    <span className="flex flex-wrap gap-1">
                      {entity.tags.map((tag) => (
                        <span key={tag} className="rounded-md border border-line-strong px-2 py-px text-[11.5px] text-fg-dim">
                          {tag}
                        </span>
                      ))}
                    </span>
                  </span>
                  <span className="flex flex-none flex-col items-end gap-0.5">
                    <span className="font-mono text-[12.5px] font-semibold" style={{ color: deltaColor }}>
                      {delta}
                    </span>
                    <span className="text-[11.5px] text-muted">24 h</span>
                  </span>
                </button>
              );
            })}
          </div>
          {view.length === 0 ? (
            <p className="m-0 py-5 text-center text-sm text-muted">
              {entities.length === 0 ? "No account scores 25 or more right now." : "Nothing in this view."}
            </p>
          ) : null}
        </Card>

        {current ? (
          <div className="flex min-w-0 flex-[1_1_560px] flex-col">
            <Dossier
              key={current.id}
              entity={current}
              serverMedian={phaethon.serverMedian}
              pending={pending}
              onWatch={() =>
                act(
                  () => review(guildId, current.id, current.review === "watch" ? "clear" : "watch"),
                  current.review === "watch" ? `${current.name} is no longer watched.` : `${current.name} stays on the list until you clear it.`,
                )
              }
              onDismiss={() => act(() => review(guildId, current.id, "dismissed"), `${current.name} dismissed. It comes back only if its score rises by 10.`)}
              onBan={(reason) => act(() => ban(guildId, current.id, reason), `Asked Sakutina to ban ${current.name}. This takes a few seconds.`)}
            />
          </div>
        ) : (
          <section className="box-border flex-[1_1_520px] rounded-2xl border border-line bg-card px-5 py-20 text-center text-[15px] text-muted">
            {entities.length === 0
              ? "Every member looks ordinary. Accounts appear here as soon as their behavior adds up to a score of 25."
              : "Every flagged account in this view has been reviewed."}
          </section>
        )}
      </div>
    </>
  );
}

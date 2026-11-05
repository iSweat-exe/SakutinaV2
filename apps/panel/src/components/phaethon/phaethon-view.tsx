"use client";

import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardTitle } from "@/components/ui/card";
import { Locked, LockedInline } from "@/components/ui/locked";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/cn";
import {
  CATEGORIES,
  ENTITIES,
  band,
  drawDossier,
  total,
  type Entity,
  type Filter,
} from "./model";
import { EconomyPanel, EvidencePanel, FactorsPanel, HeatmapPanel, LinksPanel, RatePanel, RiskGauge } from "./panels";

function Dossier({
  entity,
  watching,
  onWatch,
  onDismiss,
  onBan,
}: Readonly<{ entity: Entity; watching: boolean; onWatch: () => void; onDismiss: () => void; onBan: () => void }>) {
  const dossier = useMemo(() => drawDossier(entity), [entity]);
  const score = total(entity);
  const { label, color } = band(score);

  return (
    <div className="flex min-w-0 flex-col gap-3.5">
      <section aria-labelledby="h-dos" className="flex flex-wrap items-center gap-x-[22px] gap-y-4 rounded-2xl border border-line bg-card px-5 py-4">
        <Avatar size={64} large />
        <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1.5">
          <h2 id="h-dos" className="m-0 font-display text-[26px] font-bold tracking-[-0.01em]">
            {entity.name}
          </h2>
          <span className="font-mono text-xs text-muted">ID {entity.uid}</span>
          <span className="text-[13px] text-fg-dim">
            Created {entity.created} • Joined {entity.joined} • {entity.status}
          </span>
          <p className="m-0 mt-1 text-sm leading-[1.45] text-fg-strong">{entity.verdict}</p>
        </div>
        <RiskGauge name={entity.name} score={score} color={color} band={label} confidence={entity.conf} />
      </section>

      <div className="flex flex-wrap items-stretch gap-3.5">
        <FactorsPanel entity={entity} color={color} />
        <EvidencePanel entity={entity} />
        {dossier.nodes.length > 0 ? <LinksPanel entity={entity} dossier={dossier} color={color} /> : null}
        <EconomyPanel entity={entity} color={color} />
        <HeatmapPanel entity={entity} dossier={dossier} />
        <RatePanel entity={entity} dossier={dossier} />
      </div>

      <section aria-label="Decision" className="flex flex-wrap gap-2.5 rounded-2xl border border-line bg-card px-[18px] py-3.5">
        <button
          type="button"
          onClick={onDismiss}
          className="min-h-[46px] flex-[1_1_100px] cursor-pointer rounded-xl border border-line-strong bg-transparent text-[13.5px] font-semibold text-fg hover:border-accent hover:bg-[#1f1a1a]"
        >
          Dismiss
        </button>
        <button
          type="button"
          aria-pressed={watching}
          onClick={onWatch}
          className={cn(
            "min-h-[46px] flex-[1_1_100px] cursor-pointer rounded-xl border text-[13.5px] font-semibold text-fg hover:border-accent hover:bg-[#1f1a1a]",
            watching ? "border-accent bg-selected" : "border-line-strong bg-transparent",
          )}
        >
          {watching ? "Watching" : "Watch"}
        </button>
        <button
          type="button"
          onClick={onBan}
          className="min-h-[46px] flex-[1_1_100px] cursor-pointer rounded-xl border border-accent bg-accent text-[13.5px] font-bold text-on-accent"
        >
          Ban account
        </button>
      </section>
    </div>
  );
}

export function PhaethonView() {
  const [filter, setFilter] = useState<Filter>("All");
  const [selected, setSelected] = useState<number | null>(null);
  const [gone, setGone] = useState<ReadonlyArray<number>>([]);
  const [watch, setWatch] = useState<ReadonlyArray<number>>([]);
  const [banned, setBanned] = useState(0);
  const [dismissed, setDismissed] = useState(0);

  const live = ENTITIES.filter((e) => !gone.includes(e.id));
  const countOf = (c: Filter) => (c === "All" ? live.length : live.filter((e) => e.cats.includes(c)).length);
  const view = live.filter((e) => filter === "All" || e.cats.includes(filter)).sort((a, b) => total(b) - total(a));
  const current = view.find((e) => e.id === selected) ?? view[0];
  const clusters = live.filter((e) => (e.links ?? []).length >= 3).length;

  const ticker = [
    ["Members tracked", "1,284"],
    ["Clusters", String(clusters)],
    ["Banned, 7 d", String(9 + banned)],
    ["False flags, 7 d", String(3 + dismissed)],
  ] as const;

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-x-7 gap-y-3">
        <div className="flex flex-wrap items-baseline gap-3.5">
          <h1 className="m-0 font-display text-[34px] leading-[1.1] font-bold tracking-[-0.02em]">Phaethon</h1>
          <span className="text-sm text-muted">Behavioral intelligence on every member of the server</span>
        </div>
        <LockedInline feature="phaethon">
          <dl className="m-0 flex flex-wrap gap-x-7 gap-y-2">
            {ticker.map(([label, value]) => (
              <div key={label} className="flex flex-col gap-px">
                <dt className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">{label}</dt>
                <dd className="m-0 font-mono text-[17px] font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
        </LockedInline>
      </header>

      <Locked feature="phaethon" className="flex flex-wrap items-start gap-3.5 rounded-2xl">
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
              const score = total(entity);
              const { color } = band(score);
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
                      {score}
                    </span>
                    <span aria-hidden="true" className="h-1 w-full overflow-hidden rounded-sm bg-[#2a2a2d]">
                      <span className="block h-full" style={{ width: `${score}%`, background: color }} />
                    </span>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-[5px]">
                    <span className="truncate text-sm font-semibold">{entity.name}</span>
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
          {view.length === 0 ? <p className="m-0 py-5 text-center text-sm text-muted">Nothing left in this view.</p> : null}
        </Card>

        {current ? (
          <div className="flex min-w-0 flex-[1_1_560px] flex-col">
            <Dossier
              key={current.id}
              entity={current}
              watching={watch.includes(current.id)}
              onWatch={() =>
                setWatch((w) => (w.includes(current.id) ? w.filter((id) => id !== current.id) : [...w, current.id]))
              }
              onDismiss={() => {
                setGone((g) => [...g, current.id]);
                setDismissed((n) => n + 1);
              }}
              onBan={() => {
                setGone((g) => [...g, current.id]);
                setBanned((n) => n + 1);
              }}
            />
          </div>
        ) : (
          <section className="box-border flex-[1_1_520px] rounded-2xl border border-line bg-card px-5 py-20 text-center text-[15px] text-muted">
            Every flagged account in this view has been reviewed.
          </section>
        )}
      </Locked>
    </>
  );
}

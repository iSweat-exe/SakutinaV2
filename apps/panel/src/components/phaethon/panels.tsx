import { Card, CardTitle } from "@/components/ui/card";
import { number } from "@/lib/format";
import {
  FACTORS,
  SEVERITY_COLOR,
  type Dossier,
  type Entity,
} from "./model";

const SANS = "DM Sans, system-ui, sans-serif";
const MONO = "JetBrains Mono, ui-monospace, monospace";

function PanelTitle({ id, title, note }: Readonly<{ id: string; title: string; note: string }>) {
  return (
    <div className="flex flex-col gap-0.5">
      <CardTitle id={id} size={17}>
        {title}
      </CardTitle>
      <span className="text-[12.5px] text-muted">{note}</span>
    </div>
  );
}

export function RiskGauge({ name, score, color, band, confidence }: Readonly<{ name: string; score: number; color: string; band: string; confidence: number }>) {
  return (
    <div className="flex flex-none flex-col items-center gap-0.5">
      <svg role="img" aria-label={`Risk score ${score} out of 100 for ${name}`} viewBox="0 0 240 150" width="230" className="block h-auto">
        <path d="M30 120 A90 90 0 0 1 210 120" fill="none" stroke="#2a2a2d" strokeWidth="14" strokeLinecap="round" />
        <path d="M30 120 A90 90 0 0 1 210 120" fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" strokeDasharray={`${((282.7 * score) / 100).toFixed(1)} 400`} />
        <text x="120" y="104" textAnchor="middle" fontFamily={MONO} fontSize="52" fontWeight="700" fill="#ffffff">{score}</text>
        <text x="120" y="136" textAnchor="middle" fontFamily={MONO} fontSize="14" fill="#c4c4ca">/ 100</text>
      </svg>
      <span className="text-[13px] font-semibold" style={{ color }}>
        {band} risk • {confidence}% confidence
      </span>
    </div>
  );
}

export function FactorsPanel({ entity, color }: Readonly<{ entity: Entity; color: string }>) {
  const factors = FACTORS.map(([label, max], i) => ({ label, max, pts: entity.pts[i] ?? 0 }))
    .map((f) => ({ ...f, pct: Math.round((f.pts / f.max) * 100) }))
    .filter((f) => f.pts > 0);

  return (
    <Card labelledBy="h-fac" className="flex-[1_1_300px] gap-3 px-[18px] py-4">
      <PanelTitle id="h-fac" title="Why this score" note="Every factor that adds points, out of its maximum" />
      {factors.length === 0 ? <p className="m-0 text-[13px] text-muted">No factor adds points right now.</p> : null}
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {factors.map((f) => (
          <li key={f.label} className="flex flex-col gap-[5px]">
            <div className="flex justify-between text-[13px]">
              <span>{f.label}</span>
              <span className="font-mono font-semibold">
                {f.pts} <span className="font-normal text-muted">/ {f.max}</span>
              </span>
            </div>
            <span aria-hidden="true" className="h-1.5 overflow-hidden rounded-[3px] bg-[#2a2a2d]">
              <span className="block h-full" style={{ width: `${f.pct}%`, background: color }} />
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function EvidencePanel({ entity }: Readonly<{ entity: Entity }>) {
  return (
    <Card labelledBy="h-evt" className="flex-[1_1_340px] gap-2 px-[18px] pt-4 pb-2">
      <PanelTitle id="h-evt" title="Evidence" note="Recorded events, oldest first (times in UTC)" />
      {entity.events.length === 0 ? <p className="m-0 border-t border-divider py-[9px] text-[13px] text-muted">Nothing recorded in the last 30 days.</p> : null}
      <ol className="m-0 flex list-none flex-col p-0">
        {entity.events.map(([time, kind, severity, text], i) => (
          <li key={`${i}-${time}-${text}`} className="flex items-start gap-2.5 border-t border-divider py-[9px]">
            <span className="w-[74px] flex-none pt-0.5 font-mono text-[11.5px] text-muted">{time}</span>
            <span
              className="box-border w-[52px] flex-none rounded-[5px] border py-px text-center font-mono text-[11px] font-semibold"
              style={{ borderColor: SEVERITY_COLOR[severity], color: SEVERITY_COLOR[severity] }}
            >
              {kind}
            </span>
            <span className="flex-1 text-[13px] leading-[1.4] text-fg-strong">{text}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function LinksPanel({ entity, dossier, color }: Readonly<{ entity: Entity; dossier: Dossier; color: string }>) {
  return (
    <Card labelledBy="h-net" className="flex-[1_1_380px] gap-2 px-[18px] pt-4 pb-3.5">
      <PanelTitle id="h-net" title="Linked accounts" note="Number is the account's own risk score. Thicker line, stronger link." />
      <svg role="img" aria-label={`Network of accounts linked to ${entity.name}`} viewBox="0 0 400 250" width="100%" className="block h-auto">
        {dossier.nodes.map((n) => (
          <line key={`l-${n.id}`} x1="200" y1="120" x2={n.x} y2={n.y} stroke="#5a5a60" strokeWidth={n.width} />
        ))}
        {dossier.nodes.map((n) => (
          <g key={n.id}>
            <title>{`${n.name}: ${n.relation}`}</title>
            <circle cx={n.x} cy={n.y} r="20" fill={n.color} />
            <text x={n.x} y={n.ty} textAnchor="middle" fontSize="13" fontWeight="700" fill="#141415" fontFamily={MONO}>{n.score}</text>
            <text x={n.x} y={n.ly} textAnchor="middle" fontSize="11.5" fontWeight="600" fill="#f0efed" fontFamily={SANS}>{n.name}</text>
            <text x={n.x} y={n.ry} textAnchor="middle" fontSize="10.5" fill="#a6a6ad" fontFamily={SANS}>{n.relation}</text>
          </g>
        ))}
        <circle cx="200" cy="120" r="9" fill="#151516" stroke={color} strokeWidth="3" />
      </svg>
    </Card>
  );
}

export function EconomyPanel({ entity, color }: Readonly<{ entity: Entity; color: string }>) {
  const eco = entity.eco;
  if (!eco) return null;
  const casino = eco.casino;
  const winPct = casino ? Math.round((casino[0] / casino[1]) * 100) : 0;

  return (
    <Card labelledBy="h-eco" className="flex-[1_1_340px] gap-2.5 px-[18px] pt-4 pb-3">
      <PanelTitle id="h-eco" title="Economy" note="Coin transfers out of line with normal play" />
      <ul className="m-0 flex list-none flex-col p-0">
        {eco.transfers.map(([who, direction, coins], i) => (
          <li key={`${i}-${who}-${direction}`} className="flex items-center gap-2.5 border-t border-divider py-2 text-[13px]">
            <span className="w-[66px] flex-none text-xs text-muted">{direction === "out" ? "Sent to" : "Received from"}</span>
            <span className="min-w-0 flex-1 truncate font-semibold">{who}</span>
            <span className="flex-none font-mono font-semibold" style={{ color: direction === "out" ? "#ff8a80" : "#4ade80" }}>
              {direction === "out" ? "-" : "+"}
              {number(coins)}
            </span>
          </li>
        ))}
      </ul>
      {casino ? (
        <div className="flex flex-col gap-1.5 border-t border-divider pt-2.5">
          <div className="flex justify-between text-[13px]">
            <span>Casino win rate</span>
            <span className="font-mono font-semibold">{casino[0]} of {casino[1]} won</span>
          </div>
          <div role="img" aria-label={`Win rate ${winPct} percent, chance alone gives about 50 percent`} className="relative h-2.5 rounded-[5px] bg-[#2a2a2d]">
            <span className="absolute top-0 bottom-0 left-0 rounded-[5px]" style={{ width: `${winPct}%`, background: color }} />
            <span className="absolute -top-[3px] -bottom-[3px] left-1/2 w-0.5 bg-info" />
          </div>
          <span className="text-xs text-muted">Blue mark: what chance alone gives (50%)</span>
        </div>
      ) : null}
    </Card>
  );
}

export function HeatmapPanel({ entity, dossier }: Readonly<{ entity: Entity; dossier: Dossier }>) {
  const heat = dossier.heat;
  if (!heat) return null;
  const note = entity.heatNote;

  return (
    <Card labelledBy="h-heat" className="flex-[1_1_480px] gap-2 px-[18px] pt-4 pb-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
        <PanelTitle id="h-heat" title="Activity rhythm" note={note} />
        <span className="flex items-center gap-1.5 text-[11.5px] text-muted">
          Fewer
          <svg aria-hidden="true" width="80" height="10">
            {[0.08, 0.3, 0.55, 0.8, 1].map((o, i) => (
              <rect key={o} x={i * 16} width="16" height="10" className="fill-accent" fillOpacity={o} />
            ))}
          </svg>
          More
        </span>
      </div>
      <svg role="img" aria-label={`Messages by hour of day over the last 7 days for ${entity.name}. ${note}`} viewBox="0 0 640 186" width="100%" className="block h-auto">
        {heat.labels.map((d, i) => (
          <text key={`${i}-${d}`} x="32" y={4 + i * 22 + 14} textAnchor="end" fontSize="11" fill="#a6a6ad" fontFamily={SANS}>{d}</text>
        ))}
        {heat.cells.map((c) => (
          <rect key={`${c.x}-${c.y}`} x={c.x} y={c.y} width="22" height="18" rx="3" className="fill-accent" fillOpacity={c.o}>
            <title>{c.title}</title>
          </rect>
        ))}
        {[0, 6, 12, 18, 23].map((h) => (
          <text key={h} x={40 + h * 25 + 11} y="180" textAnchor="middle" fontSize="11" fill="#a6a6ad" fontFamily={MONO}>
            {String(h).padStart(2, "0")}h
          </text>
        ))}
      </svg>
    </Card>
  );
}

export function RatePanel({ entity, dossier }: Readonly<{ entity: Entity; dossier: Dossier }>) {
  const rate = dossier.rate;
  if (!rate) return null;

  return (
    <Card labelledBy="h-cad" className="flex-[1_1_480px] gap-2 px-[18px] pt-4 pb-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
        <PanelTitle id="h-cad" title="Message rate" note={entity.rateNote} />
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-dim">
          <span className="flex items-center gap-1.5">
            <svg aria-hidden="true" width="20" height="8"><path d="M0 4h20" className="stroke-accent" strokeWidth="2.5" /></svg>
            This member
          </span>
          <span className="flex items-center gap-1.5">
            <svg aria-hidden="true" width="20" height="8"><path d="M0 4h20" stroke="#6aa7ff" strokeWidth="2" strokeDasharray="4 3" /></svg>
            Server median
          </span>
          <span className="flex items-center gap-1.5">
            <svg aria-hidden="true" width="12" height="12"><circle cx="6" cy="6" r="4.5" fill="#fbbf24" /></svg>
            Over 3x the median
          </span>
        </div>
      </div>
      <svg role="img" aria-label={`Messages per hour sent by ${entity.name} over 72 hours compared to the server median`} viewBox="0 0 760 180" width="100%" className="block h-auto">
        {rate.grid.map((g) => (
          <g key={g.label}>
            <line x1="40" x2="740" y1={g.y} y2={g.y} stroke="#2e2e31" />
            <text x="32" y={g.ty} textAnchor="end" fontSize="11" fill="#a6a6ad" fontFamily={MONO}>{g.label}</text>
          </g>
        ))}
        <line x1="40" x2="740" y1={rate.medianY} y2={rate.medianY} stroke="#6aa7ff" strokeWidth="2" strokeDasharray="5 4" />
        <path d={rate.area} className="fill-accent/12" />
        <path d={rate.line} className="stroke-accent" fill="none" strokeWidth="2" strokeLinejoin="round" />
        {rate.spikes.map((s) => (
          <circle key={`${s.x}-${s.y}`} cx={s.x} cy={s.y} r="4" fill="#fbbf24" stroke="#151516" strokeWidth="1.5" />
        ))}
        {rate.ticks.map((t) => (
          <text key={t.label} x={t.x} y="174" textAnchor="middle" fontSize="11" fill="#a6a6ad" fontFamily={SANS}>{t.label}</text>
        ))}
      </svg>
    </Card>
  );
}

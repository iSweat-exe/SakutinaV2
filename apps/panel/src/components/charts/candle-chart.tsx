"use client";

import { useId, useState } from "react";
import { PERIODS, type Candle, type Period } from "@/lib/panel-db/market-schema";

/** Chart colors (from the Market chart design): rising and falling candles, moving average, Bollinger bands. */
const UP = "#4ade80";
const DOWN = "#ff8a80";
const MA_COLOR = "#6aa7ff";
const BB_COLOR = "#c4b5fd";
const GRID = "#2e2e31";
const TEXT_DIM = "#a6a6ad";
const TEXT_SOFT = "#d9d9de";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => (n < 10 ? "0" : "") + n;
const clock = (t: number) => {
  const d = new Date(t);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};
const day = (t: number) => {
  const d = new Date(t);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
};
const intraday = (period: Period) => period === "15m" || period === "1H";
const full = (t: number, period: Period) => (intraday(period) ? `${day(t)}, ${clock(t)}` : `${day(t)}, ${new Date(t).getUTCFullYear()}`);
/** A price in hundredths of a coin, with two decimals. */
const price = (cents: number) => (cents / 100).toFixed(2);
const compact = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}K` : String(Math.round(v)));

// Geometry of the 1100 × 560 drawing: price pane, then volume pane, then the time axis.
const L = 16;
const W = 1004;
const PT = 28;
const PB = 360;
const VT = 388;
const VB = 470;

function sma(values: readonly number[], n: number): (number | null)[] {
  return values.map((_, i) => (i < n - 1 ? null : values.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0) / n));
}

type Layers = Readonly<{ ma: boolean; bb: boolean; vol: boolean }>;

function Toggle({ label, checked, onToggle }: Readonly<{ label: string; checked: boolean; onToggle: () => void }>) {
  const id = useId();

  return (
    <div className="flex items-center gap-2.5">
      <span id={id} className="text-[13.5px] font-medium">
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        onClick={onToggle}
        className="flex h-11 w-14 flex-none cursor-pointer items-center justify-center border-0 bg-transparent p-0"
      >
        <span className={`box-border block h-[26px] w-[46px] rounded-[13px] p-[3px] transition-colors motion-reduce:transition-none ${checked ? "bg-accent" : "bg-[#3a3a3e]"}`}>
          <span
            className={`block h-5 w-5 rounded-full transition-transform motion-reduce:transition-none ${checked ? "translate-x-5 bg-on-accent" : "bg-[#d9d9de]"}`}
          />
        </span>
      </button>
    </div>
  );
}

/**
 * Candlestick chart of the Casino share price, as in the Market chart design: candle period picker, moving average
 * (10), Bollinger bands (20, 2σ) and volume, each switchable, with a hover readout. Candles come filled (one per
 * period, see `fillCandles`).
 */
export function CandleChart({
  title,
  candles,
  initialPeriod = "1H",
}: Readonly<{ title: string; candles: Readonly<Record<Period, ReadonlyArray<Candle>>>; initialPeriod?: Period }>) {
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [layers, setLayers] = useState<Layers>({ ma: true, bb: true, vol: true });
  const [hover, setHover] = useState<number | null>(null);
  const headingId = useId();
  const data = candles[period];
  const n = data.length;

  // Price axis with round steps and some room above and below.
  let lo = Math.min(...data.map((c) => c.l));
  let hi = Math.max(...data.map((c) => c.h));
  if (hi === lo) {
    hi += Math.max(1, hi * 0.02);
    lo = Math.max(0, lo - Math.max(1, lo * 0.02));
  }
  const room = (hi - lo) * 0.1;
  lo = Math.max(0, lo - room);
  hi += room;
  const raw = (hi - lo) / 6;
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const stepP = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((x) => x >= raw) ?? raw;
  const Y = (v: number) => PB - ((v - lo) / (hi - lo)) * (PB - PT);
  const grid: number[] = [];
  for (let v = Math.ceil(lo / stepP) * stepP; v <= hi; v += stepP) grid.push(v);

  const step = W / Math.max(n, 1);
  const bodyWidth = step * 0.64;
  const CX = (i: number) => L + step * (i + 0.5);
  const vmax = Math.max(1, ...data.map((c) => c.v));

  const closes = data.map((c) => c.c);
  const ma = sma(closes, 10);
  const mid = sma(closes, 20);
  const sd = closes.map((_, i) => {
    const m = mid[i];
    if (m === null || m === undefined) return null;
    const window = closes.slice(i - 19, i + 1);
    return Math.sqrt(window.reduce((a, b) => a + (b - m) * (b - m), 0) / 20);
  });
  const bbUp = mid.map((m, i) => (m === null ? null : m + 2 * sd[i]!));
  const bbLo = mid.map((m, i) => (m === null ? null : m - 2 * sd[i]!));
  const pathOf = (values: readonly (number | null)[]) =>
    values.map((v, i) => (v === null ? "" : `${values[i - 1] == null ? "M" : "L"}${CX(i).toFixed(1)} ${Y(v).toFixed(1)}`)).join(" ");
  const bbIndexes = bbUp.flatMap((v, i) => (v === null ? [] : [i]));
  const bbArea =
    bbIndexes.length > 1
      ? `${pathOf(bbUp)} ${[...bbIndexes].reverse().map((i) => `L${CX(i).toFixed(1)} ${Y(bbLo[i]!).toFixed(1)}`).join(" ")} Z`
      : "";

  const index = hover ?? n - 1;
  const selected = data[index]!;
  const previousClose = index > 0 ? data[index - 1]!.c : data[0]!.o;
  const change = previousClose > 0 ? ((selected.c - previousClose) / previousClose) * 100 : 0;
  const last = data[n - 1]!;
  const lastColor = last.c >= last.o ? UP : DOWN;

  let hiI = 0;
  let loI = 0;
  data.forEach((c, i) => {
    if (c.h > data[hiI]!.h) hiI = i;
    if (c.l < data[loI]!.l) loI = i;
  });
  const clampX = (x: number) => Math.max(50, Math.min(990, x));

  // Eight time ticks; the date is shown only when it changes (intraday periods).
  const tickIndexes = Array.from({ length: 8 }, (_, k) => Math.round(((k + 0.5) * n) / 8 - 0.5)).filter((i, k, all) => i >= 0 && i < n && all.indexOf(i) === k);
  let previousDay = "";
  const ticks = tickIndexes.map((i) => {
    const t = data[i]!.t;
    const label = intraday(period) ? clock(t) : day(t);
    const date = day(t);
    const showDate = intraday(period) && date !== previousDay;
    previousDay = date;
    return { x: CX(i), label, date: showDate ? date : "" };
  });

  const stats = [
    { label: "Open", value: price(selected.o) },
    { label: "High", value: price(selected.h) },
    { label: "Low", value: price(selected.l) },
    { label: "Volume", value: compact(selected.v) },
  ];

  return (
    <section
      aria-labelledby={headingId}
      className="box-border flex flex-col justify-between gap-3.5 rounded-2xl border border-line bg-card px-5 pt-[18px] pb-3.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-7 gap-y-3.5">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1.5">
          <h2 id={headingId} className="m-0 font-display text-xl font-bold">
            {title}
          </h2>
          <span className="font-display text-[34px] font-bold tabular-nums">{price(selected.c)}</span>
          <span className="text-[15px] font-semibold tabular-nums" style={{ color: change >= 0 ? UP : DOWN }}>
            {`${change >= 0 ? "+" : ""}${change.toFixed(2)}%`}
          </span>
          <span className="text-[12.5px] text-muted">{full(selected.t, period)}</span>
        </div>
        <dl className="m-0 flex flex-wrap gap-x-[26px] gap-y-2">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col gap-px">
              <dt className="text-xs text-muted">{stat.label}</dt>
              <dd className="m-0 text-[15px] font-semibold tabular-nums">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2.5">
        <div role="radiogroup" aria-label="Candle period" className="flex flex-wrap gap-2">
          {PERIODS.map((p) => {
            const on = p === period;

            return (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  setPeriod(p);
                  setHover(null);
                }}
                className={`min-h-11 min-w-14 cursor-pointer rounded-[10px] border px-4 text-[13.5px] font-semibold hover:border-accent ${
                  on ? "border-accent bg-[#26262a] text-white" : "border-[#3a3a3e] bg-transparent text-[#c4c4ca]"
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-x-[22px] gap-y-1">
          <Toggle label="Moving average" checked={layers.ma} onToggle={() => setLayers({ ...layers, ma: !layers.ma })} />
          <Toggle label="Bollinger bands" checked={layers.bb} onToggle={() => setLayers({ ...layers, bb: !layers.bb })} />
          <Toggle label="Volume" checked={layers.vol} onToggle={() => setLayers({ ...layers, vol: !layers.vol })} />
        </div>
      </div>

      <svg
        role="img"
        aria-label={`Candlestick chart of the Casino share. Green candles closed higher than they opened, red candles lower. Last price ${price(last.c)}.`}
        viewBox="0 0 1100 560"
        width="100%"
        className="my-auto block h-auto"
      >
        <defs>
          <linearGradient id="market-pane" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.035" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="market-bb" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={BB_COLOR} stopOpacity="0.16" />
            <stop offset="1" stopColor={BB_COLOR} stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <rect x="16" y="28" width="1004" height="332" rx="10" fill="url(#market-pane)" />
        {grid.map((v) => (
          <g key={v}>
            <line x1="16" x2="1020" y1={Y(v).toFixed(1)} y2={Y(v).toFixed(1)} stroke={GRID} strokeOpacity="0.85" />
            <text x="1030" y={(Y(v) + 4).toFixed(1)} fontSize="12" fill={TEXT_DIM}>
              {price(v)}
            </text>
          </g>
        ))}

        {layers.bb && bbArea ? (
          <g>
            <path d={bbArea} fill="url(#market-bb)" />
            <path d={pathOf(bbUp)} fill="none" stroke={BB_COLOR} strokeOpacity="0.55" strokeWidth="1.2" />
            <path d={pathOf(bbLo)} fill="none" stroke={BB_COLOR} strokeOpacity="0.55" strokeWidth="1.2" />
          </g>
        ) : null}

        {layers.vol ? (
          <g>
            <line x1="16" x2="1020" y1="378" y2="378" stroke={GRID} />
            <text x="20" y="372" fontSize="11.5" fill={TEXT_DIM}>
              Volume
            </text>
            <text x="1030" y={VT + 8} fontSize="11.5" fill={TEXT_DIM}>
              {compact(vmax)}
            </text>
            <text x="1030" y="474" fontSize="11.5" fill={TEXT_DIM}>
              0
            </text>
            {data.map((c, i) => {
              const h = (c.v / vmax) * (VB - VT);

              return (
                <rect
                  key={c.t}
                  x={(CX(i) - bodyWidth / 2).toFixed(1)}
                  y={(VB - h).toFixed(1)}
                  width={bodyWidth.toFixed(1)}
                  height={h.toFixed(1)}
                  rx="1.5"
                  fill={c.c >= c.o ? UP : DOWN}
                  fillOpacity={i === index && hover !== null ? 0.95 : 0.4}
                />
              );
            })}
          </g>
        ) : null}

        {data.map((c, i) => {
          const color = c.c >= c.o ? UP : DOWN;
          const yo = Y(c.o);
          const yc = Y(c.c);

          return (
            <g key={c.t}>
              <line x1={CX(i).toFixed(1)} x2={CX(i).toFixed(1)} y1={Y(c.h).toFixed(1)} y2={Y(c.l).toFixed(1)} stroke={color} strokeWidth="1.5" strokeLinecap="round" />
              <rect
                x={(CX(i) - bodyWidth / 2).toFixed(1)}
                y={Math.min(yo, yc).toFixed(1)}
                width={bodyWidth.toFixed(1)}
                height={Math.max(2, Math.abs(yo - yc)).toFixed(1)}
                rx="2"
                fill={color}
              />
            </g>
          );
        })}

        {layers.ma ? <path d={pathOf(ma)} fill="none" stroke={MA_COLOR} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" /> : null}

        <g pointerEvents="none" fontSize="11.5" fill={TEXT_SOFT}>
          <line x1={CX(hiI)} x2={CX(hiI)} y1={Y(data[hiI]!.h) - 14} y2={Y(data[hiI]!.h) - 4} stroke={TEXT_SOFT} strokeOpacity="0.6" />
          <text x={clampX(CX(hiI))} y={Y(data[hiI]!.h) - 18} textAnchor="middle">
            {`High ${price(data[hiI]!.h)}`}
          </text>
          <line x1={CX(loI)} x2={CX(loI)} y1={Y(data[loI]!.l) + 4} y2={Y(data[loI]!.l) + 14} stroke={TEXT_SOFT} strokeOpacity="0.6" />
          <text x={clampX(CX(loI))} y={Y(data[loI]!.l) + 27} textAnchor="middle">
            {`Low ${price(data[loI]!.l)}`}
          </text>
        </g>

        <line x1="16" x2="1020" y1={Y(last.c)} y2={Y(last.c)} stroke={lastColor} strokeDasharray="4 4" strokeOpacity="0.8" />
        <rect x="1022" y={Y(last.c) - 12} width="74" height="24" rx="6" fill={lastColor} />
        <text x="1059" y={Y(last.c) + 4.5} textAnchor="middle" fontSize="13" fontWeight="700" fill="#141415">
          {price(last.c)}
        </text>

        <g fontSize="12" fontWeight="600">
          {layers.ma && ma[index] != null ? (
            <text x="20" y="18" fill={MA_COLOR}>
              {`MA 10   ${price(ma[index]!)}`}
            </text>
          ) : null}
          {layers.bb && bbUp[index] != null ? (
            <text x="190" y="18" fill={BB_COLOR}>
              {`Bollinger 20, 2σ   ${price(bbLo[index]!)} to ${price(bbUp[index]!)}`}
            </text>
          ) : null}
        </g>

        {hover !== null ? (
          <g pointerEvents="none">
            <rect x={L + step * index} y="28" width={step} height="442" fill="#ffffff" fillOpacity="0.06" />
            <line x1="16" x2="1020" y1={Y(selected.c)} y2={Y(selected.c)} stroke={TEXT_SOFT} strokeOpacity="0.55" strokeDasharray="3 4" />
            <rect x="1022" y={Y(selected.c) - 12} width="74" height="24" rx="6" fill="#f0efed" />
            <text x="1059" y={Y(selected.c) + 4.5} textAnchor="middle" fontSize="13" fontWeight="700" fill="#141415">
              {price(selected.c)}
            </text>
            <rect x={Math.max(16, Math.min(1020 - 104, CX(index) - 52))} y="478" width="104" height="24" rx="6" fill="#f0efed" />
            <text x={Math.max(68, Math.min(968, CX(index)))} y="494" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="#141415">
              {full(selected.t, period).replace(/, \d{4}$/, "")}
            </text>
          </g>
        ) : null}

        {ticks.map((tick) => (
          <g key={tick.x}>
            <line x1={tick.x} x2={tick.x} y1="360" y2="366" stroke="#55555a" />
            <text x={tick.x} y="494" textAnchor="middle" fontSize="12" fill={TEXT_DIM}>
              {tick.label}
            </text>
            <text x={tick.x} y="512" textAnchor="middle" fontSize="11.5" fontWeight="600" fill={TEXT_SOFT}>
              {tick.date}
            </text>
          </g>
        ))}

        {data.map((c, i) => (
          <rect
            key={c.t}
            className="cursor-crosshair"
            x={L + step * i}
            y="0"
            width={step}
            height="472"
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
      </svg>
    </section>
  );
}

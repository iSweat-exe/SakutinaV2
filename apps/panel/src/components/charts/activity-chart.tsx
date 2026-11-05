"use client";

import { ChartAnnouncement, ChartTooltip, type TooltipRow } from "@/components/charts/chart-tooltip";
import { useChartHover } from "@/components/charts/use-chart-hover";
import { hourRangeTitle, number } from "@/lib/format";

type Props = Readonly<{
  /** 24 hourly values, oldest first. */
  messages: ReadonlyArray<number>;
  /** Hour of day (0-23) of each value, for the axis. Defaults to 0..23. */
  hours?: ReadonlyArray<number>;
  /** ISO time at which each hour starts, for the hover card ("Thu, Nov 5 · 17:00–18:00 UTC"). */
  times?: ReadonlyArray<string>;
  /** Second series, drawn dashed. Absent when the data does not exist. */
  voice?: ReadonlyArray<number>;
  /** Hours (fractional) bounding a suspected raid, drawn as a band. */
  raid?: Readonly<{ from: number; to: number }>;
}>;

const WIDTH = 800;
const LEFT = 40;
const RIGHT = 788;
const TOP = 22;
const BOTTOM = 212;
const VOICE = "#6aa7ff";

/** Messages and voice minutes per hour over 24 h, with an optional raid band. Hover (or arrow keys) reads one hour. */
export function ActivityChart({ messages, hours: hourLabels, times, voice, raid }: Props) {
  const hours = messages.length;
  const max = Math.max(100, Math.ceil(Math.max(...messages, ...(voice ?? [])) / 100) * 100);
  const x = (hour: number) => LEFT + hour * ((RIGHT - LEFT) / (hours - 1));
  const y = (value: number) => BOTTOM - (value / max) * (BOTTOM - TOP);
  const line = (values: ReadonlyArray<number>) =>
    values.map((value, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(value).toFixed(1)}`).join(" ");

  const grid = [0, 1, 2, 3, 4].map((step) => (max / 4) * step);
  const ticks = [0, 6, 12, 18, hours - 1];
  const font = "DM Sans, system-ui, sans-serif";

  const { active, svgRef, bind } = useChartHover(hours, LEFT, RIGHT, WIDTH);

  const label = `Messages per hour${voice ? " and voice minutes per hour" : ""} over the last 24 hours${
    raid ? `, with a suspected raid shaded around ${String(Math.round((raid.from + raid.to) / 2)).padStart(2, "0")}:00` : ""
  }. Use the left and right arrow keys to read each hour.`;

  const hover =
    active === null
      ? null
      : {
          title: times?.[active]
            ? hourRangeTitle(times[active])
            : `${String(hourLabels?.[active] ?? active).padStart(2, "0")}:00`,
          rows: [
            { label: "Messages", value: number(messages[active] ?? 0), color: "var(--color-accent)" },
            ...(voice ? [{ label: "Voice minutes", value: number(voice[active] ?? 0), color: VOICE, dashed: true }] : []),
          ] satisfies TooltipRow[],
        };

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        {...bind}
        role="img"
        aria-label={label}
        viewBox={`0 0 ${WIDTH} 250`}
        width="100%"
        className="m-auto block h-auto touch-pan-y rounded-lg outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent"
      >
        {raid ? (
          <>
            <rect
              x={x(raid.from).toFixed(1)}
              y={TOP}
              width={(x(raid.to) - x(raid.from)).toFixed(1)}
              height={BOTTOM - TOP}
              fill="#fbbf24"
              fillOpacity="0.14"
              stroke="#fbbf24"
              strokeOpacity="0.6"
              strokeDasharray="3 3"
            />
            <text x={x(raid.from).toFixed(1)} dx="6" y="15" fontSize="11" fontWeight="600" fill="#fbbf24" fontFamily={font}>
              Suspected Raid
            </text>
          </>
        ) : null}
        {grid.map((value) => (
          <g key={value}>
            <line x1={LEFT} x2={RIGHT} y1={y(value).toFixed(1)} y2={y(value).toFixed(1)} stroke="#2e2e31" strokeWidth="1" />
            <text x="32" y={(y(value) + 4).toFixed(1)} textAnchor="end" fontSize="11" fill="#a6a6ad" fontFamily={font}>
              {value}
            </text>
          </g>
        ))}
        {ticks.map((hour) => (
          <text key={hour} x={x(hour).toFixed(1)} y="240" textAnchor="middle" fontSize="11" fill="#a6a6ad" fontFamily={font}>
            {String(hourLabels?.[hour] ?? hour).padStart(2, "0")}h
          </text>
        ))}
        {voice ? (
          <path d={line(voice)} fill="none" stroke={VOICE} strokeWidth="2" strokeDasharray="5 4" strokeLinejoin="round" strokeLinecap="round" />
        ) : null}
        <path d={line(messages)} className="stroke-accent" fill="none" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

        {active !== null ? (
          <g pointerEvents="none">
            <line x1={x(active).toFixed(1)} x2={x(active).toFixed(1)} y1={TOP - 6} y2={BOTTOM} stroke="#a6a6ad" strokeOpacity="0.55" strokeWidth="1" strokeDasharray="4 3" />
            {voice ? <circle cx={x(active).toFixed(1)} cy={y(voice[active] ?? 0).toFixed(1)} r="4.5" fill="#151516" stroke={VOICE} strokeWidth="2" /> : null}
            <circle cx={x(active).toFixed(1)} cy={y(messages[active] ?? 0).toFixed(1)} r="5" fill="#151516" className="stroke-accent" strokeWidth="2.5" />
          </g>
        ) : null}
      </svg>
      {hover && active !== null ? <ChartTooltip at={(x(active) / WIDTH) * 100} title={hover.title} rows={hover.rows} /> : null}
      <ChartAnnouncement {...(hover ?? { title: null })} />
    </div>
  );
}

/** Legend matching the chart above. */
export function ActivityLegend({ withVoice, withRaid }: Readonly<{ withVoice: boolean; withRaid: boolean }>) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-fg-dim">
      <span className="flex items-center gap-[7px]">
        <svg aria-hidden="true" width="20" height="8" viewBox="0 0 20 8">
          <path d="M0 4h20" className="stroke-accent" strokeWidth="2.5" />
        </svg>
        Messages / h
      </span>
      {withVoice ? (
        <span className="flex items-center gap-[7px]">
          <svg aria-hidden="true" width="20" height="8" viewBox="0 0 20 8">
            <path d="M0 4h20" stroke={VOICE} strokeWidth="2.5" strokeDasharray="4 3" />
          </svg>
          Voice minutes / h
        </span>
      ) : null}
      {withRaid ? (
        <span className="flex items-center gap-[7px]">
          <svg aria-hidden="true" width="14" height="10" viewBox="0 0 14 10">
            <rect width="14" height="10" rx="2" fill="#fbbf24" fillOpacity="0.35" stroke="#fbbf24" />
          </svg>
          Suspected raid
        </span>
      ) : null}
    </div>
  );
}

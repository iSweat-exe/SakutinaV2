"use client";

import { ChartAnnouncement, ChartTooltip } from "@/components/charts/chart-tooltip";
import { niceScale } from "@/components/charts/scale";
import { useChartHover } from "@/components/charts/use-chart-hover";
import { axisLabels, number, signed } from "@/lib/format";

type Props = Readonly<{
  /** One value per day, in coins, oldest first. */
  values: ReadonlyArray<number>;
  /** Short axis label of each day ("Thu"). */
  days: ReadonlyArray<string>;
  /** Hover card title of each day ("Thu, Nov 5"). Defaults to the axis label. */
  titles?: ReadonlyArray<string>;
  /** What the values count, lower-cased in the hover card ("coins"). */
  unit?: string;
}>;

const WIDTH = 800;
const LEFT = 70;
const RIGHT = 770;
const FLOOR = 180;
const CEIL = 30;

/** Area chart of the coins in circulation. Hover (or arrow keys) reads one day and its change. */
export function CirculationChart({ values, days, titles, unit = "coins" }: Props) {
  const { lo, hi, step } = niceScale(Math.min(...values), Math.max(...values));
  const x = (i: number) => LEFT + i * ((RIGHT - LEFT) / Math.max(values.length - 1, 1));
  const y = (v: number) => FLOOR - ((v - lo) / (hi - lo)) * (FLOOR - CEIL);
  const line = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(values.length - 1).toFixed(1)} ${FLOOR} L${x(0).toFixed(1)} ${FLOOR} Z`;
  const font = "DM Sans, system-ui, sans-serif";

  const grid: number[] = [];
  for (let i = 0; i <= Math.round((hi - lo) / step); i++) {
    grid.push(lo + i * step);
  }

  const gridLabels = axisLabels(grid);

  const { active, svgRef, bind } = useChartHover(values.length, LEFT, RIGHT, WIDTH);

  const first = values[0] ?? 0;
  const last = values[values.length - 1] ?? 0;
  const hover =
    active === null
      ? null
      : {
          title: titles?.[active] ?? days[active] ?? "",
          rows: [
            { label: "In circulation", value: `${number(values[active] ?? 0)} ${unit}`, color: "var(--color-accent)" },
            ...(active > 0
              ? [{ label: "Since the day before", value: signed((values[active] ?? 0) - (values[active - 1] ?? 0)), color: "#a6a6ad" }]
              : []),
          ],
        };

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        {...bind}
        role="img"
        aria-label={`${unit} in circulation went from ${number(first)} to ${number(last)} over the last ${values.length} days. Use the left and right arrow keys to read each day.`}
        viewBox={`0 0 ${WIDTH} 220`}
        width="100%"
        className="block h-auto touch-pan-y rounded-lg outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent"
      >
        {grid.map((v, i) => (
          <g key={v}>
            <line x1="56" x2="788" y1={y(v).toFixed(1)} y2={y(v).toFixed(1)} stroke="#2e2e31" strokeWidth="1" />
            <text x="48" y={(y(v) + 4).toFixed(1)} textAnchor="end" fontSize="12" fill="#a6a6ad" fontFamily={font}>
              {gridLabels[i]}
            </text>
          </g>
        ))}
        <path d={area} className="fill-accent/12" />
        <path d={line} className="stroke-accent" fill="none" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {values.map((v, i) => (
          <g key={days[i] ?? i}>
            <circle cx={x(i).toFixed(1)} cy={y(v).toFixed(1)} r={active === i ? 5.5 : 4} fill="#151516" className="stroke-accent" strokeWidth="2" />
            <text x={x(i).toFixed(1)} y="212" textAnchor="middle" fontSize="12" fill={active === i ? "#f0efed" : "#a6a6ad"} fontFamily={font}>
              {days[i]}
            </text>
          </g>
        ))}
        {active !== null ? (
          <line
            pointerEvents="none"
            x1={x(active).toFixed(1)}
            x2={x(active).toFixed(1)}
            y1={CEIL - 8}
            y2={FLOOR}
            stroke="#a6a6ad"
            strokeOpacity="0.55"
            strokeWidth="1"
            strokeDasharray="4 3"
          />
        ) : null}
      </svg>
      {hover && active !== null ? <ChartTooltip at={(x(active) / WIDTH) * 100} title={hover.title} rows={hover.rows} /> : null}
      <ChartAnnouncement {...(hover ?? { title: null })} />
    </div>
  );
}

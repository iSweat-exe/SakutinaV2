"use client";

import { ChartAnnouncement, ChartTooltip } from "@/components/charts/chart-tooltip";
import { niceScale } from "@/components/charts/scale";
import { Measured } from "@/components/charts/measured";
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

/**
 * Where the drawing sits: `WIDE` is the 800 × 220 drawing of the design, scaled to the card; `narrow` is drawn at
 * the card's real width (below 1024 px) so its labels keep their size, with one day label every `labelEvery`.
 */
type Geometry = Readonly<{ WIDTH: number; LEFT: number; RIGHT: number; gridFrom: number; gridTo: number; labelX: number; labelEvery: number }>;

const WIDE: Geometry = { WIDTH: 800, LEFT: 70, RIGHT: 770, gridFrom: 56, gridTo: 788, labelX: 48, labelEvery: 1 };
const FLOOR = 180;
const CEIL = 30;

function narrow(width: number, count: number): Geometry {
  const LEFT = 58;
  const RIGHT = width - 22;
  const spacing = (RIGHT - LEFT) / Math.max(count - 1, 1);

  return { WIDTH: width, LEFT, RIGHT, gridFrom: 46, gridTo: width - 4, labelX: 40, labelEvery: Math.max(1, Math.ceil(46 / spacing)) };
}

/** Area chart of the coins in circulation. Hover, touch (or arrow keys) reads one day and its change. */
export function CirculationChart(props: Props) {
  return (
    <>
      <div className="contents max-lg:hidden">
        <CirculationPlot {...props} g={WIDE} />
      </div>
      <Measured className="lg:hidden" minHeight={220}>
        {(width) => <CirculationPlot {...props} g={narrow(width, props.values.length)} />}
      </Measured>
    </>
  );
}

function CirculationPlot({ values, days, titles, unit = "coins", g }: Props & Readonly<{ g: Geometry }>) {
  const { WIDTH, LEFT, RIGHT } = g;
  /** Day labels kept, counted back from the last one ("Today"), which is always shown. */
  const shown = (i: number) => (values.length - 1 - i) % g.labelEvery === 0;
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
            <line x1={g.gridFrom} x2={g.gridTo} y1={y(v).toFixed(1)} y2={y(v).toFixed(1)} stroke="#2e2e31" strokeWidth="1" />
            <text x={g.labelX} y={(y(v) + 4).toFixed(1)} textAnchor="end" fontSize="12" fill="#a6a6ad" fontFamily={font}>
              {gridLabels[i]}
            </text>
          </g>
        ))}
        <path d={area} className="fill-accent/12" />
        <path d={line} className="stroke-accent" fill="none" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {values.map((v, i) => (
          <g key={days[i] ?? i}>
            <circle cx={x(i).toFixed(1)} cy={y(v).toFixed(1)} r={active === i ? 5.5 : 4} fill="#151516" className="stroke-accent" strokeWidth="2" />
            {shown(i) ? (
              <text x={x(i).toFixed(1)} y="212" textAnchor="middle" fontSize="12" fill={active === i ? "#f0efed" : "#a6a6ad"} fontFamily={font}>
                {days[i]}
              </text>
            ) : null}
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

type Props = Readonly<{
  /** One value per day, in millions of coins, oldest first. */
  values: ReadonlyArray<number>;
  days: ReadonlyArray<string>;
}>;

const LEFT = 70;
const WIDTH = 700;
const FLOOR = 180;
const CEIL = 30;

/** Area chart of the coins in circulation. */
export function CirculationChart({ values, days }: Props) {
  const lo = Math.floor((Math.min(...values) - 0.02) * 10) / 10;
  const hi = Math.max(lo + 0.2, Math.ceil((Math.max(...values) + 0.02) * 10) / 10);
  const x = (i: number) => LEFT + i * (WIDTH / (values.length - 1));
  const y = (v: number) => FLOOR - ((v - lo) / (hi - lo)) * (FLOOR - CEIL);
  const line = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(values.length - 1).toFixed(1)} ${FLOOR} L${x(0).toFixed(1)} ${FLOOR} Z`;
  const font = "DM Sans, system-ui, sans-serif";

  const grid: number[] = [];
  for (let v = lo; v <= hi + 1e-9; v += 0.1) {
    grid.push(Number(v.toFixed(1)));
  }

  const first = values[0] ?? 0;
  const last = values[values.length - 1] ?? 0;

  return (
    <svg
      role="img"
      aria-label={`Coins in circulation went from ${first.toFixed(2)} million to ${last.toFixed(2)} million over the last ${values.length} days`}
      viewBox="0 0 800 220"
      width="100%"
      className="block h-auto"
    >
      {grid.map((v) => (
        <g key={v}>
          <line x1="56" x2="788" y1={y(v).toFixed(1)} y2={y(v).toFixed(1)} stroke="#2e2e31" strokeWidth="1" />
          <text x="48" y={(y(v) + 4).toFixed(1)} textAnchor="end" fontSize="12" fill="#a6a6ad" fontFamily={font}>
            {v.toFixed(1)}M
          </text>
        </g>
      ))}
      <path d={area} className="fill-accent/12" />
      <path d={line} className="stroke-accent" fill="none" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {values.map((v, i) => (
        <g key={days[i] ?? i}>
          <circle cx={x(i).toFixed(1)} cy={y(v).toFixed(1)} r="4" fill="#151516" className="stroke-accent" strokeWidth="2" />
          <text x={x(i).toFixed(1)} y="212" textAnchor="middle" fontSize="12" fill="#a6a6ad" fontFamily={font}>
            {days[i]}
          </text>
        </g>
      ))}
    </svg>
  );
}

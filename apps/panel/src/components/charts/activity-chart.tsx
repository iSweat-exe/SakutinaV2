type Props = Readonly<{
  /** 24 hourly values, oldest first. */
  messages: ReadonlyArray<number>;
  voice: ReadonlyArray<number>;
  /** Hours (fractional) bounding a suspected raid, drawn as a band. */
  raid?: Readonly<{ from: number; to: number }>;
}>;

const LEFT = 40;
const RIGHT = 788;
const TOP = 22;
const BOTTOM = 212;

/** Messages and voice sessions per hour over 24 h, with an optional raid band. */
export function ActivityChart({ messages, voice, raid }: Props) {
  const hours = messages.length;
  const max = Math.max(100, Math.ceil(Math.max(...messages, ...voice) / 100) * 100);
  const x = (hour: number) => LEFT + hour * ((RIGHT - LEFT) / (hours - 1));
  const y = (value: number) => BOTTOM - (value / max) * (BOTTOM - TOP);
  const line = (values: ReadonlyArray<number>) =>
    values.map((value, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(value).toFixed(1)}`).join(" ");

  const grid = [0, 1, 2, 3, 4].map((step) => (max / 4) * step);
  const ticks = [0, 6, 12, 18, hours - 1];
  const font = "DM Sans, system-ui, sans-serif";

  const label = `Messages per hour and voice sessions per hour over the last 24 hours${
    raid ? `, with a suspected raid shaded around ${String(Math.round((raid.from + raid.to) / 2)).padStart(2, "0")}:00` : ""
  }`;

  return (
    <svg role="img" aria-label={label} viewBox="0 0 800 250" width="100%" className="m-auto block h-auto">
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
          {String(hour).padStart(2, "0")}h
        </text>
      ))}
      <path d={line(voice)} fill="none" stroke="#6aa7ff" strokeWidth="2" strokeDasharray="5 4" strokeLinejoin="round" strokeLinecap="round" />
      <path d={line(messages)} className="stroke-accent" fill="none" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Legend matching the chart above. */
export function ActivityLegend({ withRaid }: Readonly<{ withRaid: boolean }>) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-fg-dim">
      <span className="flex items-center gap-[7px]">
        <svg aria-hidden="true" width="20" height="8" viewBox="0 0 20 8">
          <path d="M0 4h20" className="stroke-accent" strokeWidth="2.5" />
        </svg>
        Messages / h
      </span>
      <span className="flex items-center gap-[7px]">
        <svg aria-hidden="true" width="20" height="8" viewBox="0 0 20 8">
          <path d="M0 4h20" stroke="#6aa7ff" strokeWidth="2.5" strokeDasharray="4 3" />
        </svg>
        Voice sessions / h
      </span>
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

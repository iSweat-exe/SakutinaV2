export type TooltipRow = Readonly<{
  label: string;
  value: string;
  /** Colour of the swatch, matching the series on the chart. */
  color: string;
  /** Dashed swatch for a dashed series. */
  dashed?: boolean;
}>;

type Props = Readonly<{
  /** Horizontal position of the hovered point, as a percentage of the chart's width. */
  at: number;
  title: string;
  rows: ReadonlyArray<TooltipRow>;
}>;

/**
 * Floating card describing the hovered point of a chart. It sits above the plot and flips
 * to the other side of the line near the edges so it is never clipped. Decorative for a pointer;
 * the same text is announced by {@link ChartAnnouncement} for keyboard and screen-reader users.
 */
export function ChartTooltip({ at, title, rows }: Props) {
  const shift = at > 70 ? "-100% - 14px" : at < 30 ? "14px" : "-50%";

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute top-1 z-10 w-max min-w-36 whitespace-nowrap rounded-xl border border-line-strong bg-raised px-3 py-2 shadow-[0_8px_24px_rgb(0_0_0/0.45)]"
      style={{ left: `${at}%`, transform: `translateX(calc(${shift}))` }}
    >
      <div className="mb-1.5 text-[12px] font-semibold text-fg-soft">{title}</div>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-4 text-[12.5px]">
            <span className="flex items-center gap-2 text-fg-dim">
              <svg aria-hidden="true" width="14" height="6" viewBox="0 0 14 6">
                <path d="M0 3h14" stroke={row.color} strokeWidth="2.5" strokeDasharray={row.dashed ? "4 3" : undefined} />
              </svg>
              {row.label}
            </span>
            <span className="font-semibold tabular-nums text-fg">{row.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The hovered point as plain text for assistive technology (polite live region). */
export function ChartAnnouncement({ title, rows }: Readonly<{ title: string; rows: ReadonlyArray<TooltipRow> } | { title: null; rows?: never }>) {
  return (
    <div className="sr-clip" aria-live="polite">
      {title ? `${title}: ${rows.map((row) => `${row.label} ${row.value}`).join(", ")}` : ""}
    </div>
  );
}

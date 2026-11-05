import type { ReactNode } from "react";

type Props = Readonly<{
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  /** Padding: dashboard tiles are slightly roomier. */
  roomy?: boolean;
  valueClassName?: string;
  className?: string;
}>;

export function StatCard({ label, value, sub, roomy, valueClassName, className }: Props) {
  return (
    <div
      className={`flex flex-col gap-1.5 rounded-2xl border border-line bg-card ${roomy ? "px-5 py-[18px]" : "px-[18px] py-4"} ${className ?? ""}`}
    >
      <span className="text-[13px] text-muted">{label}</span>
      <span className={`font-display text-[28px] font-bold ${valueClassName ?? ""}`}>{value}</span>
      {sub ? <span className="text-[12.5px] text-muted">{sub}</span> : null}
    </div>
  );
}

/** Responsive grid used for rows of key figures. */
export function StatGrid({ children, min = 220 }: Readonly<{ children: ReactNode; min?: number }>) {
  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}px, 100%), 1fr))` }}
    >
      {children}
    </div>
  );
}

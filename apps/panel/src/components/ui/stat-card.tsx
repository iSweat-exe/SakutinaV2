import type { CSSProperties, ReactNode } from "react";

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
      className={`flex flex-col gap-1.5 rounded-2xl border border-line bg-card ${roomy ? "px-5 py-[18px]" : "px-[18px] py-4"} max-sm:px-3.5 max-sm:py-3.5 ${className ?? ""}`}
    >
      <span className="text-[13px] text-muted">{label}</span>
      <span className={`font-display text-[28px] font-bold max-sm:text-[22px] ${valueClassName ?? ""}`}>{value}</span>
      {sub ? <span className="text-[12.5px] text-muted">{sub}</span> : null}
    </div>
  );
}

/**
 * Responsive grid used for rows of key figures. Below 1024 px it is two columns (a lone last tile takes the
 * whole row); from there, as many columns of at least `min` px as fit.
 */
export function StatGrid({ children, min = 220 }: Readonly<{ children: ReactNode; min?: number }>) {
  return (
    <div
      className="grid gap-4 max-lg:grid-cols-2 max-sm:gap-3 max-lg:[&>:last-child:nth-child(odd)]:col-span-2 lg:[grid-template-columns:repeat(auto-fit,minmax(min(var(--stat-min),100%),1fr))]"
      style={{ "--stat-min": `${min}px` } as CSSProperties}
    >
      {children}
    </div>
  );
}

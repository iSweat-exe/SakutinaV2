import type { ReactNode } from "react";

type Props = Readonly<{
  title: string;
  description?: string;
  /** Right-hand slot (master switch, summary…). */
  aside?: ReactNode;
}>;

export function PageHeader({ title, description, aside }: Props) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <div className="flex flex-col gap-1.5">
        <h1 className="m-0 font-display text-[38px] leading-[1.1] font-bold tracking-[-0.02em] max-sm:text-[32px]">{title}</h1>
        {description ? <p className="m-0 text-[15px] text-muted">{description}</p> : null}
      </div>
      {aside}
    </header>
  );
}

/** "Protection on [switch]" pill placed in a page header. */
export function MasterSwitch({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <div className="flex items-center gap-1.5 rounded-[14px] border border-line bg-card py-1 pr-1.5 pl-[18px]">
      <span className="text-sm font-semibold">{label}</span>
      {children}
    </div>
  );
}

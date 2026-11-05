import type { ReactNode } from "react";

/** A labelled setting with a control on the right (usually a <Switch>). */
export function SettingRow({
  label,
  description,
  children,
}: Readonly<{ label: string; description?: string; children: ReactNode }>) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 border-t border-divider pt-1.5">
      <div className="flex flex-col gap-px">
        <span className="text-[14.5px] font-semibold">{label}</span>
        {description ? <span className="text-[12.5px] text-muted">{description}</span> : null}
      </div>
      {children}
    </div>
  );
}

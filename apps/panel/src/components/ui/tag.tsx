import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Small bordered label ("Mute", "High", "Alt cluster"…). */
export function Tag({
  children,
  color,
  className,
}: Readonly<{ children: ReactNode; color?: string; className?: string }>) {
  return (
    <span
      className={cn(
        "inline-block rounded-lg border border-line-strong px-2.5 py-[3px] text-center text-xs font-semibold text-fg-soft",
        className,
      )}
      style={color ? { borderColor: color, color } : undefined}
    >
      {children}
    </span>
  );
}

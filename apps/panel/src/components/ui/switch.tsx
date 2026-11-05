"use client";

import { cn } from "@/lib/cn";

type Props = Readonly<{
  checked: boolean;
  onChange?: (next: boolean) => void;
  /** Accessible name (the visible label is rendered next to the switch). */
  label: string;
}>;

export function Switch({ checked, onChange, label }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange?.(!checked)}
      className="flex h-11 w-14 flex-none cursor-pointer items-center justify-center border-0 bg-transparent p-0"
    >
      <span
        className={cn(
          "block h-[26px] w-[46px] rounded-[13px] p-[3px] transition-colors duration-[180ms] motion-reduce:transition-none",
          checked ? "bg-accent" : "bg-line-strong",
        )}
      >
        <span
          className={cn(
            "block size-5 rounded-full transition-transform duration-[180ms] motion-reduce:transition-none",
            checked ? "translate-x-5 bg-on-accent" : "translate-x-0 bg-fg-soft",
          )}
        />
      </span>
    </button>
  );
}

"use client";

import { cn } from "@/lib/cn";

type Option<T extends string> = Readonly<{ value: T; label: string }>;

type Props<T extends string> = Readonly<{
  options: ReadonlyArray<Option<T>>;
  value: T;
  onChange?: (value: T) => void;
  /** "rect": 44px buttons (filters, actions). "pill": 36px chips (watchlist filters). */
  shape?: "rect" | "pill";
  labelledBy?: string;
  label?: string;
}>;

/** A radio group drawn as buttons. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  shape = "rect",
  labelledBy,
  label,
}: Props<T>) {
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-label={label}
      className={cn("flex flex-wrap", shape === "pill" ? "gap-1.5" : "gap-2")}
    >
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange?.(option.value)}
            className={cn(
              "cursor-pointer border font-sans font-semibold transition-colors hover:border-accent",
              shape === "pill"
                ? "min-h-9 rounded-full px-3 text-[12.5px]"
                : "min-h-11 rounded-[10px] px-[18px] text-[13.5px]",
              selected ? "border-accent bg-selected text-white" : "border-line-strong bg-transparent text-fg-dim",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

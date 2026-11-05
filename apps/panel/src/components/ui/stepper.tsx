"use client";

import { useId } from "react";

type Props = Readonly<{
  label: string;
  value: number;
  step: number;
  /** Largest allowed value (the database refuses more). */
  max?: number;
  /** Text after the number ("per day"). */
  unit: string;
  onChange?: (value: number) => void;
}>;

const BUTTON =
  "flex size-11 flex-none cursor-pointer items-center justify-center rounded-xl border border-line-strong bg-selected text-xl text-fg hover:border-accent";

/** − [ number unit ] + */
export function Stepper({ label, value, step, max = Number.MAX_SAFE_INTEGER, unit, onChange }: Props) {
  const id = useId();
  const clamp = (next: number) => Math.min(max, Math.max(0, Number.isFinite(next) ? Math.round(next) : 0));

  return (
    <div className="flex items-center gap-2">
      <button type="button" aria-label={`Decrease ${label}`} onClick={() => onChange?.(clamp(value - step))} className={BUTTON}>
        −
      </button>
      <div className="box-border flex h-11 min-w-0 flex-1 items-baseline justify-center gap-1.5 rounded-xl border border-line bg-bg px-2.5 focus-within:border-accent">
        <label htmlFor={id} className="sr-clip">
          {label}
        </label>
        <input
          id={id}
          className="bare no-spin"
          type="number"
          min={0}
          max={max}
          value={value}
          onChange={(event) => onChange?.(clamp(Number(event.target.value)))}
        />
        <span className="self-center text-[12.5px] text-muted">{unit}</span>
      </div>
      <button type="button" aria-label={`Increase ${label}`} onClick={() => onChange?.(clamp(value + step))} className={BUTTON}>
        +
      </button>
    </div>
  );
}

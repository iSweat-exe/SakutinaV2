"use client";

import { useId } from "react";

type Props = Readonly<{
  label: string;
  hint: string;
  min: number;
  max: number;
  value: number;
  /** Text shown at the right of the label ("10 joins"). */
  shown: string;
  onChange?: (value: number) => void;
}>;

export function Slider({ label, hint, min, max, value, shown, onChange }: Props) {
  const id = useId();

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[14.5px] font-semibold">
          {label}
        </label>
        <span className="text-sm font-semibold text-accent">{shown}</span>
      </div>
      <span className="text-[12.5px] text-muted">{hint}</span>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange?.(Number(event.target.value))}
      />
    </div>
  );
}

import { TONE_STYLE, type StatusTone } from "./bot-status";

export function StatusDot({ tone, size = 9, spread = 3 }: Readonly<{ tone: StatusTone; size?: number; spread?: number }>) {
  const { color, ring } = TONE_STYLE[tone];

  return (
    <span
      aria-hidden="true"
      className="flex-none rounded-full"
      style={{ width: size, height: size, background: color, boxShadow: `0 0 0 ${spread}px ${ring}` }}
    />
  );
}

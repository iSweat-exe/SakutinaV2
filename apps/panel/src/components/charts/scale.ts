/**
 * A round scale around the data: `lo`, `hi` and a step that is 1, 2 or 5 times a power of ten.
 * A flat series (all values equal) gets room on both sides so its line sits in the middle,
 * never lower than zero.
 */
export function niceScale(min: number, max: number): Readonly<{ lo: number; hi: number; step: number }> {
  if (min === max) {
    const room = Math.max(Math.abs(max) * 0.2, 10);
    return niceScale(Math.max(0, min - room), max + room);
  }

  const raw = (max - min) / 4;
  const power = 10 ** Math.floor(Math.log10(raw));
  const factor = raw / power;
  const step = (factor <= 1 ? 1 : factor <= 2 ? 2 : factor <= 5 ? 5 : 10) * power;
  const lo = Math.floor(min / step) * step;
  const hi = Math.max(Math.ceil(max / step) * step, lo + step);

  return { lo, hi, step };
}

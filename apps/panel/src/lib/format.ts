/** "14 days, 6 hours", "3 hours, 12 minutes", "45 seconds". */
export function formatUptime(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);

  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

  if (days > 0) {
    return `${unit(days, "day")}, ${unit(hours, "hour")}`;
  }
  if (hours > 0) {
    return `${unit(hours, "hour")}, ${unit(minutes, "minute")}`;
  }
  if (minutes > 0) {
    return unit(minutes, "minute");
  }
  return unit(seconds, "second");
}

/** "pièces" → "Pièces". */
export const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export const number = (value: number) => value.toLocaleString("en-US");

/** "1.2M", "12.5K", "950". */
export const compact = (value: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);

/** From this value on, a figure is abbreviated: below, it is written in full (a balance of 1,250 stays 1,250). */
export const SHORT_FROM = 10_000;

/** A figure at a glance: exact up to 9,999, then abbreviated with one decimal at most ("12.3K", "500.2K", "1M"). */
export const short = (value: number) => (Math.abs(value) < SHORT_FROM ? number(value) : compact(value));

/** Axis labels: "250", "1.25K", "3M" (up to two decimals, trailing zeros dropped). */
export const compactAxis = (value: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value);

/** Axis labels for a set of ticks: as few decimals as it takes for every label to differ ("1.01M", "1.015M"…). */
export function axisLabels(values: ReadonlyArray<number>): string[] {
  for (let digits = 0; digits <= 3; digits++) {
    const format = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: digits });
    const labels = values.map((value) => format.format(value));

    if (new Set(labels).size === labels.length) {
      return labels;
    }
  }

  return values.map(number);
}

/** "+120", "-45", "0": a signed change. */
export const signed = (value: number) => (value > 0 ? `+${number(value)}` : number(value));

const UTC_DAY = { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" } as const;

/** "Thu, Nov 5" for a `YYYY-MM-DD` or ISO date, read in UTC. */
export const dayTitle = (date: string) => new Date(date.length === 10 ? `${date}T00:00:00Z` : date).toLocaleDateString("en-US", UTC_DAY);

/** "Thu" for a `YYYY-MM-DD` date, read in UTC. */
export const dayShort = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });

/** "Thu, Nov 5 · 17:00–18:00 UTC" for the hour starting at this ISO time. */
export function hourRangeTitle(iso: string): string {
  const start = new Date(iso);
  const hour = (date: Date) => String(date.getUTCHours()).padStart(2, "0");

  return `${dayTitle(iso)} · ${hour(start)}:00–${hour(new Date(start.getTime() + 3_600_000))}:00 UTC`;
}

/** "52 min", "3 h", "6 days": how long until this ISO time, measured from `now` (ms). */
export function timeUntil(iso: string, now: number): string {
  const minutes = Math.max(1, Math.round((Date.parse(iso) - now) / 60_000));

  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"}`;
}

/** "just now", "2 min ago", "3 h ago", "4 days ago". */
export function timeAgo(date: Date, now: Date): string {
  const seconds = Math.max(0, Math.round((now.getTime() - date.getTime()) / 1_000));

  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

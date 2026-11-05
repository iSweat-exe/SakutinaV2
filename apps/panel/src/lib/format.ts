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

export const number = (value: number) => value.toLocaleString("en-US");

/** "1.2M", "12.5K", "950". */
export const compact = (value: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);

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

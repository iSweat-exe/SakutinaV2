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

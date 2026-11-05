import { getBotHealth } from "@/lib/bot-health";
import { describeHealth } from "@/components/status/bot-status";
import { StatusDot } from "@/components/status/status-dot";

/** "All Systems Operational" under the login card, read from the bot. */
export async function BotStatusLine() {
  const { tone, label } = describeHealth(await getBotHealth());

  return (
    <div className="relative flex items-center gap-2 text-[13px] text-fg-dim">
      <StatusDot tone={tone} />
      <span>{label}</span>
    </div>
  );
}

export function BotStatusLineFallback() {
  return (
    <div className="relative flex items-center gap-2 text-[13px] text-muted" aria-hidden="true">
      <span className="size-[9px] rounded-full bg-line-strong" />
      <span>Checking status…</span>
    </div>
  );
}

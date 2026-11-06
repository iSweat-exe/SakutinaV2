import { describeHealth } from "@/components/status/bot-status";
import { StatusDot } from "@/components/status/status-dot";
import { getBotHealth } from "@/lib/bot-health";

/** Live bot status: the one block of the dashboard that is wired today. */
export async function DashboardHeader() {
  const { tone, label, detail } = describeHealth(await getBotHealth());

  return (
    <header className="flex flex-col gap-2">
      <div className="flex items-center gap-3.5 max-sm:items-start">
        {/* On a phone the title can wrap: the dot stays level with its first line. */}
        <span className="flex max-sm:mt-3">
          <StatusDot tone={tone} size={12} spread={5} />
        </span>
        <h1 className="m-0 font-display text-[38px] leading-[1.1] font-bold tracking-[-0.02em] max-sm:text-[32px]">{label}</h1>
      </div>
      <p className="m-0 text-[15px] text-muted">{detail}</p>
    </header>
  );
}

export function DashboardHeaderFallback() {
  return (
    <header className="flex flex-col gap-2" aria-hidden="true">
      <div className="flex items-center gap-3.5">
        <span className="size-3 rounded-full bg-line-strong" />
        <h1 className="m-0 font-display text-[38px] leading-[1.1] font-bold tracking-[-0.02em] text-muted max-sm:text-[32px]">Checking status…</h1>
      </div>
      <p className="m-0 text-[15px]">&nbsp;</p>
    </header>
  );
}

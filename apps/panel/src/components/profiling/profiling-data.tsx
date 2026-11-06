import { AccessNotice } from "@/components/shell/access-notice";
import { guildIdOrNotFound } from "@/lib/guild-id";
import { getPanelAccess } from "@/lib/panel-db/access";
import { getProfiling } from "@/lib/panel-db/profiling";
import { ProfilingView } from "./profiling-view";

/**
 * Loads one server's most active members with the signed-in user's session, then hands plain props to the client
 * view. Reads cookies and the route: render it in <Suspense>.
 */
export async function ProfilingData({ params }: Readonly<{ params: Promise<{ guildId: string }> }>) {
  const guildId = guildIdOrNotFound((await params).guildId);
  const access = await getPanelAccess(guildId);

  if (access.state !== "granted") {
    return <AccessNotice state={access.state} />;
  }

  const profiling = await getProfiling(guildId).catch((error: unknown) => {
    console.error("panel profiling unavailable", error);
    return null;
  });

  return profiling ? <ProfilingView guildId={guildId} profiling={profiling} /> : <AccessNotice state="unavailable" />;
}

export function ProfilingDataFallback() {
  return (
    <div aria-hidden="true" className="flex flex-wrap items-start gap-4">
      <div className="h-[560px] max-w-[460px] min-w-[280px] flex-[1_1_340px] rounded-2xl border border-line bg-card" />
      <div className="h-[560px] flex-[3_1_520px] rounded-2xl border border-line bg-card" />
    </div>
  );
}

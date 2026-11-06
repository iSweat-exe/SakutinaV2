import { AccessNotice } from "@/components/shell/access-notice";
import { guildIdOrNotFound } from "@/lib/guild-id";
import { getPanelAccess } from "@/lib/panel-db/access";
import { getModules } from "@/lib/panel-db/modules";
import { getProfiling } from "@/lib/panel-db/profiling";
import { ModuleOff } from "@/components/modules/module-off";
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

  const modules = await getModules(guildId).catch(() => null);

  if (modules && !modules.profiling) {
    return (
      <ModuleOff
        guildId={guildId}
        modules={modules}
        module="profiling"
        title="Profiling"
        description="Member profiles are hidden for this server. Nothing changes for the bot: activity is still counted and kept 30 days."
      />
    );
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

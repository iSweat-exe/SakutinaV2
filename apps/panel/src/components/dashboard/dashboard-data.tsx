import { AccessNotice } from "@/components/shell/access-notice";
import { timeAgo } from "@/lib/format";
import { guildIdOrNotFound } from "@/lib/guild-id";
import { getPanelAccess } from "@/lib/panel-db/access";
import { toAuditLines } from "@/lib/panel-db/audit-lines";
import { getRecentModeration } from "@/lib/panel-db/audit";
import { getOverview } from "@/lib/panel-db/overview";
import { DashboardBody } from "./dashboard-body";

/**
 * Loads one server's dashboard from the database with the signed-in user's session, then
 * hands plain props to the client component. Reads cookies and the route: render it in <Suspense>.
 */
export async function DashboardData({ params }: Readonly<{ params: Promise<{ guildId: string }> }>) {
  const guildId = guildIdOrNotFound((await params).guildId);
  const access = await getPanelAccess(guildId);

  if (access.state !== "granted") {
    return <AccessNotice state={access.state} />;
  }

  const loaded = await Promise.all([getOverview(guildId), getRecentModeration(guildId, 6)]).then(
    ([overview, audit]) => ({ overview, audit }),
    () => null,
  );

  if (!loaded) {
    return <AccessNotice state="unavailable" />;
  }

  const now = new Date();
  const logs = toAuditLines(loaded.audit).map((line) => ({
    id: line.id,
    tag: line.tag,
    text: line.text,
    when: timeAgo(line.occurredAt, now),
  }));

  return <DashboardBody overview={loaded.overview} logs={logs} />;
}

export function DashboardDataFallback() {
  return (
    <div aria-hidden="true" className="flex flex-1 flex-col gap-4">
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))]">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[118px] rounded-2xl border border-line bg-card" />
        ))}
      </div>
      <div className="min-h-[360px] flex-1 rounded-2xl border border-line bg-card" />
    </div>
  );
}

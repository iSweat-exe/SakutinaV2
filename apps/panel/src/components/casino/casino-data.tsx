import { AccessNotice } from "@/components/shell/access-notice";
import { guildIdOrNotFound } from "@/lib/guild-id";
import { getPanelAccess } from "@/lib/panel-db/access";
import { getCasino } from "@/lib/panel-db/casino";
import { CasinoView } from "./casino-view";

/**
 * Loads one server's casino with the signed-in user's session, then hands plain props to the client view.
 * Reads cookies and the route: render it in <Suspense>.
 */
export async function CasinoData({ params }: Readonly<{ params: Promise<{ guildId: string }> }>) {
  const guildId = guildIdOrNotFound((await params).guildId);
  const access = await getPanelAccess(guildId);

  if (access.state !== "granted") {
    return <AccessNotice state={access.state} />;
  }

  const casino = await getCasino(guildId).catch(() => null);

  return casino ? <CasinoView guildId={guildId} casino={casino} /> : <AccessNotice state="unavailable" />;
}

export function CasinoDataFallback() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))]">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[104px] rounded-2xl border border-line bg-card" />
        ))}
      </div>
      <div className="h-[420px] rounded-2xl border border-line bg-card" />
    </div>
  );
}

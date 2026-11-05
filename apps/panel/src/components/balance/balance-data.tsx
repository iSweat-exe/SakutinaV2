import { AccessNotice } from "@/components/shell/access-notice";
import { guildIdOrNotFound } from "@/lib/guild-id";
import { getPanelAccess } from "@/lib/panel-db/access";
import { getEconomy } from "@/lib/panel-db/economy";
import { getTreasury } from "@/lib/panel-db/treasury";
import { BalanceView } from "./balance-view";

/**
 * Loads one server's economy with the signed-in user's session, then hands plain props to the
 * client view. Reads cookies and the route: render it in <Suspense>.
 */
export async function BalanceData({ params }: Readonly<{ params: Promise<{ guildId: string }> }>) {
  const guildId = guildIdOrNotFound((await params).guildId);
  const access = await getPanelAccess(guildId);

  if (access.state !== "granted") {
    return <AccessNotice state={access.state} />;
  }

  const [economy, treasury] = await Promise.all([getEconomy(guildId).catch(() => null), getTreasury(guildId).catch(() => null)]);

  return economy && treasury ? <BalanceView guildId={guildId} economy={economy} treasury={treasury} /> : <AccessNotice state="unavailable" />;
}

export function BalanceDataFallback() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))]">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[104px] rounded-2xl border border-line bg-card" />
        ))}
      </div>
      <div className="h-[300px] rounded-2xl border border-line bg-card" />
    </div>
  );
}

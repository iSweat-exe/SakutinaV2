import { AccessNotice } from "@/components/shell/access-notice";
import { guildIdOrNotFound } from "@/lib/guild-id";
import { getPanelAccess } from "@/lib/panel-db/access";
import { getEconomy } from "@/lib/panel-db/economy";
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

  const economy = await getEconomy(guildId).catch(() => null);

  return economy ? <BalanceView economy={economy} /> : <AccessNotice state="unavailable" />;
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

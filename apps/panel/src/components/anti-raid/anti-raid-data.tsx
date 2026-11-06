import { AccessNotice } from "@/components/shell/access-notice";
import { guildIdOrNotFound } from "@/lib/guild-id";
import { getPanelAccess } from "@/lib/panel-db/access";
import { getAntiRaid } from "@/lib/panel-db/anti-raid";
import { AntiRaidView } from "./anti-raid-view";

/**
 * Loads one server's Anti-Raid settings and state with the signed-in user's session, then hands plain props to the
 * client view. Reads cookies and the route: render it in <Suspense>.
 */
export async function AntiRaidData({ params }: Readonly<{ params: Promise<{ guildId: string }> }>) {
  const guildId = guildIdOrNotFound((await params).guildId);
  const access = await getPanelAccess(guildId);

  if (access.state !== "granted") {
    return <AccessNotice state={access.state} />;
  }

  const antiRaid = await getAntiRaid(guildId).catch((error: unknown) => {
    console.error("panel anti-raid unavailable", error);
    return null;
  });

  return antiRaid ? <AntiRaidView guildId={guildId} antiRaid={antiRaid} /> : <AccessNotice state="unavailable" />;
}

export function AntiRaidDataFallback() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <div className="h-[60px] rounded-2xl" />
      <div className="h-[120px] rounded-2xl border border-line bg-card" />
      <div className="flex flex-wrap gap-4">
        <div className="h-[300px] flex-[1_1_420px] rounded-2xl border border-line bg-card" />
        <div className="h-[300px] flex-[1_1_420px] rounded-2xl border border-line bg-card" />
      </div>
    </div>
  );
}

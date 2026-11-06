import { AccessNotice } from "@/components/shell/access-notice";
import { guildIdOrNotFound } from "@/lib/guild-id";
import { getPanelAccess } from "@/lib/panel-db/access";
import { getPhaethon } from "@/lib/panel-db/phaethon";
import { PhaethonView } from "./phaethon-view";

/**
 * Loads one server's Phaethon watchlist with the signed-in user's session, then hands plain props to the client view.
 * Reads cookies and the route: render it in <Suspense>.
 */
export async function PhaethonData({ params }: Readonly<{ params: Promise<{ guildId: string }> }>) {
  const guildId = guildIdOrNotFound((await params).guildId);
  const access = await getPanelAccess(guildId);

  if (access.state !== "granted") {
    return <AccessNotice state={access.state} />;
  }

  const phaethon = await getPhaethon(guildId).catch((error: unknown) => {
    console.error("panel phaethon unavailable", error);
    return null;
  });

  return phaethon ? <PhaethonView guildId={guildId} phaethon={phaethon} /> : <AccessNotice state="unavailable" />;
}

export function PhaethonDataFallback() {
  return (
    <div aria-hidden="true" className="flex flex-wrap items-start gap-3.5">
      <div className="h-[520px] min-w-[280px] flex-[0_1_340px] rounded-2xl border border-line bg-card" />
      <div className="h-[520px] flex-[1_1_560px] rounded-2xl border border-line bg-card" />
    </div>
  );
}

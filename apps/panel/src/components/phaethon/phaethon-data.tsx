import { AccessNotice } from "@/components/shell/access-notice";
import { guildIdOrNotFound } from "@/lib/guild-id";
import { getPanelAccess } from "@/lib/panel-db/access";
import { getModules } from "@/lib/panel-db/modules";
import { getPhaethon } from "@/lib/panel-db/phaethon";
import { ModuleOff } from "@/components/modules/module-off";
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

  const modules = await getModules(guildId).catch(() => null);

  if (modules && !modules.phaethon) {
    return (
      <ModuleOff
        guildId={guildId}
        modules={modules}
        module="phaethon"
        title="Phaethon"
        description="No Phaethon alerts are posted for this server and the watchlist is hidden. The bot keeps collecting metadata (never message content), so scores are ready the moment you turn it back on."
      />
    );
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

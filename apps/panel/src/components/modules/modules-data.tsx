import { AccessNotice } from "@/components/shell/access-notice";
import { guildIdOrNotFound } from "@/lib/guild-id";
import { getPanelAccess } from "@/lib/panel-db/access";
import { getModules } from "@/lib/panel-db/modules";
import { ModulesView } from "./modules-view";

/** Loads which modules are on with the signed-in user's session. Reads cookies and the route: render it in <Suspense>. */
export async function ModulesData({ params }: Readonly<{ params: Promise<{ guildId: string }> }>) {
  const guildId = guildIdOrNotFound((await params).guildId);
  const access = await getPanelAccess(guildId);

  if (access.state !== "granted") {
    return <AccessNotice state={access.state} />;
  }

  const modules = await getModules(guildId).catch(() => null);

  return modules ? <ModulesView guildId={guildId} modules={modules} /> : <AccessNotice state="unavailable" />;
}

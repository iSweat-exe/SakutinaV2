import { AccessNotice } from "@/components/shell/access-notice";
import { guildIdOrNotFound } from "@/lib/guild-id";
import { getPanelAccess } from "@/lib/panel-db/access";
import { getModeration } from "@/lib/panel-db/moderation";
import { ModerationView } from "./moderation-view";

/**
 * Loads one server's moderation with the signed-in user's session, then hands plain props to the client view.
 * Reads cookies and the route: render it in <Suspense>.
 */
export async function ModerationData({ params }: Readonly<{ params: Promise<{ guildId: string }> }>) {
  const guildId = guildIdOrNotFound((await params).guildId);
  const access = await getPanelAccess(guildId);

  if (access.state !== "granted") {
    return <AccessNotice state={access.state} />;
  }

  const moderation = await getModeration(guildId).catch((error: unknown) => {
    console.error("panel moderation unavailable", error);
    return null;
  });

  return moderation ? <ModerationView guildId={guildId} moderation={moderation} /> : <AccessNotice state="unavailable" />;
}

export function ModerationDataFallback() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))]">
        {[0, 1].map((i) => (
          <div key={i} className="h-[104px] rounded-2xl border border-line bg-card" />
        ))}
      </div>
      <div className="h-[360px] rounded-2xl border border-line bg-card" />
    </div>
  );
}

import type { Metadata } from "next";
import { Landing } from "@/components/landing/landing";
import { botInviteUrl } from "@/lib/discord-guilds";
import { getSampleProfiles } from "@/lib/sample-profiles";

export const metadata: Metadata = {
  title: { absolute: "Sakutina · Keep raids out. Keep people in." },
  description:
    "Sakutina stops raids, explains who is behaving strangely, and runs your server's economy and games. One bot, one dashboard.",
};

/**
 * Public landing page. Static: no session is read here, and the sample members
 * are cached (see getSampleProfiles), so the page is prerendered. Without the
 * bot's application id, "Add to Discord" leads to the login page.
 */
export default async function LandingPage() {
  const profiles = await getSampleProfiles(5);
  return <Landing inviteHref={botInviteUrl() ?? "/login"} loginHref="/login" profiles={profiles} />;
}

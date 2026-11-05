import type { Metadata } from "next";
import { Suspense } from "react";
import { PageMain } from "@/components/shell/page-main";
import { ServerDisabled, ServerInvite, ServerLink } from "@/components/servers/server-row";
import { Locked } from "@/components/ui/locked";
import { PRIMARY_GUILD } from "@/lib/guild";
import { getPanelUser } from "@/lib/user";

export const metadata: Metadata = { title: "Select a server" };

// Sample servers shown (locked) until the Discord "guilds" permission is wired.
const ADMIN_ONLY = [
  { name: "Lantern Café", initial: "L", meta: "318 members • 41 active", banner: "linear-gradient(120deg, #6b3a1d, #ff9a4c)" },
] as const;

const OTHERS = [
  { name: "Verdant Guild", initial: "V", meta: "5,902 members • 804 active" },
  { name: "Orbit Club", initial: "O", meta: "2,170 members • 330 active" },
  { name: "Ashen Vale", initial: "A", meta: "960 members • 118 active" },
] as const;

const count = (n: number) => `${n} ${n === 1 ? "server" : "servers"}`;

async function WelcomeName() {
  const user = await getPanelUser();
  return <>{user ? `, ${user.name}` : ""}</>;
}

export default function ServersPage() {
  return (
    <PageMain density="roomy">
      <header className="flex flex-col gap-1.5">
        <h1 className="m-0 font-display text-5xl leading-[1.1] font-bold tracking-[-0.02em]">
          Welcome
          <Suspense>
            <WelcomeName />
          </Suspense>
          !
        </h1>
        <p className="m-0 text-base text-muted">Select a server you want to manage.</p>
      </header>

      <section aria-labelledby="h-with" className="flex flex-col gap-3">
        <h2 id="h-with" className="m-0 text-[15px] font-medium text-fg-soft">
          Servers with Sakutina <span className="text-muted">• {count(1)}</span>
        </h2>
        <ServerLink
          href="/dashboard"
          server={{
            name: PRIMARY_GUILD.name,
            initial: PRIMARY_GUILD.initial,
            meta: "The server Sakutina manages",
            banner: "linear-gradient(120deg, #5b1d3a, #e5484d)",
          }}
        />
      </section>

      <Locked feature="guilds" className="flex flex-col gap-10">
        <section aria-labelledby="h-admin" className="flex flex-col gap-3">
          <h2 id="h-admin" className="m-0 text-[15px] font-medium text-fg-soft">
            Servers where you are an administrator <span className="text-muted">• {count(ADMIN_ONLY.length)}</span>
          </h2>
          {ADMIN_ONLY.map((server) => (
            <ServerInvite key={server.name} server={server} />
          ))}
        </section>

        <section aria-labelledby="h-other" className="flex flex-col gap-3">
          <h2 id="h-other" className="m-0 text-[15px] font-medium text-faint">
            Servers where you are not an administrator <span>• {count(OTHERS.length)}</span>
          </h2>
          {OTHERS.map((server) => (
            <ServerDisabled key={server.name} server={server} />
          ))}
          <div className="flex justify-center pt-1">
            <button type="button" className="min-h-11 cursor-pointer border-0 bg-transparent px-4 text-[13.5px] text-muted">
              Show more servers…
            </button>
          </div>
        </section>
      </Locked>
    </PageMain>
  );
}

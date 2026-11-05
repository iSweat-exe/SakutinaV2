import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { PageMain } from "@/components/shell/page-main";
import { ServerDisabled, ServerInvite, ServerLink } from "@/components/servers/server-row";
import { decodeGuilds, GUILDS_COOKIE, guildIconUrl, inviteUrl } from "@/lib/discord-guilds";
import { PRIMARY_GUILD } from "@/lib/guild";
import { PANEL_GUILD_ID } from "@/lib/panel-db/rpc";
import { getPanelUser } from "@/lib/user";

export const metadata: Metadata = { title: "Select a server" };

const count = (n: number) => `${n} ${n === 1 ? "server" : "servers"}`;

function PrimaryServer({ iconUrl }: Readonly<{ iconUrl: string | null }>) {
  return (
    <ServerLink
      href="/dashboard"
      server={{
        name: PRIMARY_GUILD.name,
        initial: PRIMARY_GUILD.initial,
        meta: "The server Sakutina manages",
        banner: "linear-gradient(120deg, #5b1d3a, #e5484d)",
        iconUrl,
      }}
    />
  );
}

/** The managed server, with its picture when the user's server list (cookie) has it. */
async function PrimaryServerWithIcon() {
  const guilds = decodeGuilds((await cookies()).get(GUILDS_COOKIE)?.value);
  const guild = guilds?.find((entry) => entry.id === PANEL_GUILD_ID);

  return <PrimaryServer iconUrl={guild ? guildIconUrl(guild) : null} />;
}

async function WelcomeName() {
  const user = await getPanelUser();
  return <>{user ? `, ${user.name}` : ""}</>;
}

/** The user's other Discord servers, read once at sign-in (see lib/discord-guilds.ts). */
async function YourServers() {
  const guilds = decodeGuilds((await cookies()).get(GUILDS_COOKIE)?.value);

  if (!guilds) {
    return (
      <p className="m-0 text-[13.5px] text-muted">
        Your Discord servers are not loaded. Sign out and sign in again to list them.
      </p>
    );
  }

  const others = guilds.filter((guild) => guild.id !== PANEL_GUILD_ID);
  const manageable = others.filter((guild) => guild.canManage);
  const rest = others.filter((guild) => !guild.canManage);

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="h-admin" className="flex flex-col gap-3">
        <h2 id="h-admin" className="m-0 text-[15px] font-medium text-fg-soft">
          Servers where you are an administrator <span className="text-muted">• {count(manageable.length)}</span>
        </h2>
        {manageable.map((guild) => (
          <ServerInvite
            key={guild.id}
            href={inviteUrl(guild.id)}
            server={{ name: guild.name, initial: guild.name.charAt(0).toUpperCase(), meta: "You can add Sakutina here", iconUrl: guildIconUrl(guild) }}
          />
        ))}
      </section>

      <section aria-labelledby="h-other" className="flex flex-col gap-3">
        <h2 id="h-other" className="m-0 text-[15px] font-medium text-faint">
          Servers where you are not an administrator <span>• {count(rest.length)}</span>
        </h2>
        {rest.map((guild) => (
          <ServerDisabled
            key={guild.id}
            server={{ name: guild.name, initial: guild.name.charAt(0).toUpperCase(), meta: "You need the Manage Server permission", iconUrl: guildIconUrl(guild) }}
          />
        ))}
      </section>
    </div>
  );
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
        <Suspense fallback={<PrimaryServer iconUrl={null} />}>
          <PrimaryServerWithIcon />
        </Suspense>
      </section>

      <Suspense>
        <YourServers />
      </Suspense>
    </PageMain>
  );
}

import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { PageMain } from "@/components/shell/page-main";
import { ServerDisabled, ServerInvite, ServerLink } from "@/components/servers/server-row";
import { decodeGuilds, GUILDS_COOKIE, guildBannerUrl, guildIconUrl, inviteUrl, type UserGuild } from "@/lib/discord-guilds";
import { getMyGuilds } from "@/lib/panel-db/guilds";
import type { PanelGuild } from "@/lib/panel-db/guilds-schema";
import { getPanelUser } from "@/lib/user";

export const metadata: Metadata = { title: "Select a server" };

const count = (n: number) => `${n} ${n === 1 ? "server" : "servers"}`;
const members = (n: number | null) => (n === null ? "" : `${n.toLocaleString("en-US")} ${n === 1 ? "member" : "members"}`);

async function WelcomeName() {
  const user = await getPanelUser();
  return <>{user ? `, ${user.name}` : ""}</>;
}

function SectionTitle({ id, children, muted = false }: Readonly<{ id: string; children: React.ReactNode; muted?: boolean }>) {
  return (
    <h2 id={id} className={`m-0 text-[15px] font-medium ${muted ? "text-faint" : "text-fg-soft"}`}>
      {children}
    </h2>
  );
}

/** Servers Sakutina is on that you can manage (database), then your other servers (Discord, read at sign-in). */
async function ServerLists() {
  const [managed, fromDiscord] = await Promise.all([
    getMyGuilds().catch(() => null),
    cookies().then((store) => decodeGuilds(store.get(GUILDS_COOKIE)?.value)),
  ]);

  const withBot = new Set((managed ?? []).map((guild) => guild.id));
  const others = (fromDiscord ?? []).filter((guild) => !withBot.has(guild.id));
  const addable = others.filter((guild) => guild.canManage);
  const rest = others.filter((guild) => !guild.canManage);

  return (
    <>
      <section aria-labelledby="h-with" className="flex flex-col gap-3">
        <SectionTitle id="h-with">
          Servers with Sakutina <span className="text-muted">• {count(managed?.length ?? 0)}</span>
        </SectionTitle>
        {managed === null ? (
          <p className="m-0 text-[13.5px] text-muted">The panel cannot read the database right now. Reload in a minute.</p>
        ) : managed.length === 0 ? (
          <p className="m-0 text-[13.5px] text-muted">
            Sakutina is not on any server you manage yet. Add it to one of yours below.
          </p>
        ) : (
          managed.map((guild) => <ManagedRow key={guild.id} guild={guild} />)
        )}
      </section>

      {fromDiscord === null ? (
        <p className="m-0 text-[13.5px] text-muted">
          Your other Discord servers are not loaded. Sign out and sign in again to list them.
        </p>
      ) : (
        <>
          <section aria-labelledby="h-admin" className="flex flex-col gap-3">
            <SectionTitle id="h-admin">
              Servers where you are an administrator <span className="text-muted">• {count(addable.length)}</span>
            </SectionTitle>
            {addable.map((guild) => (
              <ServerInvite key={guild.id} href={inviteUrl(guild.id)} server={rowOf(guild, "You can add Sakutina here")} />
            ))}
          </section>

          <section aria-labelledby="h-other" className="flex flex-col gap-3">
            <SectionTitle id="h-other" muted>
              Servers where you are not an administrator <span>• {count(rest.length)}</span>
            </SectionTitle>
            {rest.map((guild) => (
              <ServerDisabled key={guild.id} server={rowOf(guild, "You need the Manage Server permission")} />
            ))}
          </section>
        </>
      )}
    </>
  );
}

function ManagedRow({ guild }: Readonly<{ guild: PanelGuild }>) {
  const name = guild.name ?? `Server ${guild.id}`;
  const role = guild.role === "owner" ? "Owner" : "Administrator";

  return (
    <ServerLink
      href={`/servers/${guild.id}/dashboard`}
      server={{
        name,
        meta: [role, members(guild.memberCount)].filter(Boolean).join(" • "),
        iconUrl: guildIconUrl(guild),
        bannerUrl: guildBannerUrl(guild),
      }}
    />
  );
}

function rowOf(guild: UserGuild, meta: string) {
  return { name: guild.name, meta, iconUrl: guildIconUrl(guild), bannerUrl: guildBannerUrl(guild) };
}

function ServerListsFallback() {
  return (
    <section aria-hidden="true" className="flex flex-col gap-3">
      <div className="h-5 w-48 rounded bg-line" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[68px] rounded-[14px] border border-line bg-card" />
      ))}
    </section>
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

      <Suspense fallback={<ServerListsFallback />}>
        <ServerLists />
      </Suspense>
    </PageMain>
  );
}

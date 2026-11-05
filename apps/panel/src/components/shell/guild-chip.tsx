import { GuildAvatar } from "@/components/servers/guild-avatar";
import { guildIconUrl } from "@/lib/discord-guilds";
import { guildIdOrNotFound } from "@/lib/guild-id";
import { getGuild } from "@/lib/panel-db/guilds";

const AVATAR = "border border-[#55555a] bg-selected";
const NAME = "min-w-0 flex-1 truncate text-sm font-semibold group-data-[collapsed=true]/side:hidden";

/**
 * Picture and name of the server being viewed, inside the sidebar's server switcher.
 * Reads the session and the route: render it in <Suspense>. If the database refuses or
 * cannot answer, the id is shown (the page itself explains the refusal).
 */
export async function GuildChip({ params }: Readonly<{ params: Promise<{ guildId: string }> }>) {
  const guildId = guildIdOrNotFound((await params).guildId);
  const guild = await getGuild(guildId).catch(() => null);
  const name = guild?.name ?? `Server ${guildId}`;

  return (
    <>
      <GuildAvatar name={name} iconUrl={guild ? guildIconUrl(guild) : null} size={28} className={AVATAR} />
      <span className={NAME}>{name}</span>
    </>
  );
}

export function GuildChipFallback() {
  return (
    <>
      <span aria-hidden="true" className={`size-7 flex-none rounded-full ${AVATAR}`} />
      <span className={`${NAME} text-muted`}>Loading…</span>
    </>
  );
}

import { Suspense } from "react";
import { GuildChip, GuildChipFallback } from "@/components/shell/guild-chip";
import { Shell } from "@/components/shell/shell";
import { UserChip, UserChipFallback } from "@/components/shell/user-chip";

/** Pages of one server: `/servers/<id>/…`. Access is checked by the database on every read. */
export default function GuildLayout({ children, params }: LayoutProps<"/servers/[guildId]">) {
  return (
    <Shell
      variant="guild"
      guild={
        <Suspense fallback={<GuildChipFallback />}>
          <GuildChip params={params} />
        </Suspense>
      }
      user={
        <Suspense fallback={<UserChipFallback />}>
          <UserChip />
        </Suspense>
      }
    >
      {children}
    </Shell>
  );
}

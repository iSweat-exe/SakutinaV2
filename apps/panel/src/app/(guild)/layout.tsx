import { Suspense } from "react";
import { Shell } from "@/components/shell/shell";
import { UserChip, UserChipFallback } from "@/components/shell/user-chip";
import { PRIMARY_GUILD } from "@/lib/guild";

export default function GuildLayout({ children }: { children: React.ReactNode }) {
  return (
    <Shell
      variant="guild"
      guild={PRIMARY_GUILD}
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

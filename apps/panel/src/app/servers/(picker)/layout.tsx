import { Suspense } from "react";
import { Shell } from "@/components/shell/shell";
import { UserChip, UserChipFallback } from "@/components/shell/user-chip";

export default function ServersLayout({ children }: { children: React.ReactNode }) {
  return (
    <Shell
      variant="servers"
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

import type { Metadata } from "next";
import { Suspense } from "react";
import { AntiRaidData, AntiRaidDataFallback } from "@/components/anti-raid/anti-raid-data";
import { PageMain } from "@/components/shell/page-main";

export const metadata: Metadata = { title: "Anti-Raid" };

export default function AntiRaidPage({ params }: PageProps<"/servers/[guildId]/anti-raid">) {
  return (
    <PageMain>
      <Suspense fallback={<AntiRaidDataFallback />}>
        <AntiRaidData params={params} />
      </Suspense>
    </PageMain>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { CasinoData, CasinoDataFallback } from "@/components/casino/casino-data";
import { PageMain } from "@/components/shell/page-main";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Casino" };

export default function CasinoPage({ params }: PageProps<"/servers/[guildId]/casino">) {
  return (
    <PageMain>
      <PageHeader title="Casino" description="Choose which games are open and how much members can bet." />
      <Suspense fallback={<CasinoDataFallback />}>
        <CasinoData params={params} />
      </Suspense>
    </PageMain>
  );
}

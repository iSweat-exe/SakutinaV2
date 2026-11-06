import type { Metadata } from "next";
import { Suspense } from "react";
import { MarketData, MarketDataFallback } from "@/components/market/market-data";
import { PageMain } from "@/components/shell/page-main";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Market" };

export default function MarketPage({ params }: PageProps<"/servers/[guildId]/market">) {
  return (
    <PageMain>
      <PageHeader title="Market" description="The Casino share: its price follows the casino account, members buy and sell it in Discord." />
      <Suspense fallback={<MarketDataFallback />}>
        <MarketData params={params} />
      </Suspense>
    </PageMain>
  );
}

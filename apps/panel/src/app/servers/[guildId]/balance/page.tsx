import type { Metadata } from "next";
import { Suspense } from "react";
import { BalanceData, BalanceDataFallback } from "@/components/balance/balance-data";
import { PageMain } from "@/components/shell/page-main";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Balance" };

export default function BalancePage({ params }: PageProps<"/servers/[guildId]/balance">) {
  return (
    <PageMain>
      <PageHeader title="Balance" description="See how coins move in your server and set the rules of the economy." />
      <Suspense fallback={<BalanceDataFallback />}>
        <BalanceData params={params} />
      </Suspense>
    </PageMain>
  );
}

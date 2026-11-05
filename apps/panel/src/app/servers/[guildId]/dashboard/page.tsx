import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardData, DashboardDataFallback } from "@/components/dashboard/dashboard-data";
import { DashboardHeader, DashboardHeaderFallback } from "@/components/dashboard/dashboard-header";
import { PageMain } from "@/components/shell/page-main";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage({ params }: PageProps<"/servers/[guildId]/dashboard">) {
  return (
    <PageMain>
      <Suspense fallback={<DashboardHeaderFallback />}>
        <DashboardHeader />
      </Suspense>
      <Suspense fallback={<DashboardDataFallback />}>
        <DashboardData params={params} />
      </Suspense>
    </PageMain>
  );
}

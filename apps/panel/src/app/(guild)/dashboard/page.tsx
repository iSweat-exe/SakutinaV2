import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardBody } from "@/components/dashboard/dashboard-body";
import { DashboardHeader, DashboardHeaderFallback } from "@/components/dashboard/dashboard-header";
import { PageMain } from "@/components/shell/page-main";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <PageMain>
      <Suspense fallback={<DashboardHeaderFallback />}>
        <DashboardHeader />
      </Suspense>
      <DashboardBody />
    </PageMain>
  );
}

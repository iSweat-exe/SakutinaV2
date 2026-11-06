import type { Metadata } from "next";
import { Suspense } from "react";
import { ProfilingData, ProfilingDataFallback } from "@/components/profiling/profiling-data";
import { PageMain } from "@/components/shell/page-main";

export const metadata: Metadata = { title: "Profiling" };

export default function ProfilingPage({ params }: PageProps<"/servers/[guildId]/profiling">) {
  return (
    <PageMain>
      <Suspense fallback={<ProfilingDataFallback />}>
        <ProfilingData params={params} />
      </Suspense>
    </PageMain>
  );
}

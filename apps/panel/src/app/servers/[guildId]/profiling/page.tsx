import type { Metadata } from "next";
import { ProfilingView } from "@/components/profiling/profiling-view";
import { PageMain } from "@/components/shell/page-main";

export const metadata: Metadata = { title: "Profiling" };

export default function ProfilingPage() {
  return (
    <PageMain>
      <ProfilingView />
    </PageMain>
  );
}

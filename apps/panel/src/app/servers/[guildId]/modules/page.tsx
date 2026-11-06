import type { Metadata } from "next";
import { Suspense } from "react";
import { ModulesData } from "@/components/modules/modules-data";
import { PageMain } from "@/components/shell/page-main";

export const metadata: Metadata = { title: "Modules" };

export default function ModulesPage({ params }: PageProps<"/servers/[guildId]/modules">) {
  return (
    <PageMain>
      <Suspense>
        <ModulesData params={params} />
      </Suspense>
    </PageMain>
  );
}

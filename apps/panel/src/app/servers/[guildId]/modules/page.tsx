import type { Metadata } from "next";
import { Suspense } from "react";
import { ModulesView } from "@/components/modules/modules-view";
import { PageMain } from "@/components/shell/page-main";

export const metadata: Metadata = { title: "Modules" };

export default function ModulesPage() {
  return (
    <PageMain>
      {/* The module links point to pages of the current server: the view reads the URL. */}
      <Suspense>
        <ModulesView />
      </Suspense>
    </PageMain>
  );
}

import type { Metadata } from "next";
import { ModulesView } from "@/components/modules/modules-view";
import { PageMain } from "@/components/shell/page-main";

export const metadata: Metadata = { title: "Modules" };

export default function ModulesPage() {
  return (
    <PageMain>
      <ModulesView />
    </PageMain>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { ModerationData, ModerationDataFallback } from "@/components/moderation/moderation-data";
import { PageMain } from "@/components/shell/page-main";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Moderation" };

export default function ModerationPage({ params }: PageProps<"/servers/[guildId]/moderation">) {
  return (
    <PageMain>
      <PageHeader title="Moderation" description="Review active sanctions and set the rules Sakutina enforces on its own." />
      <Suspense fallback={<ModerationDataFallback />}>
        <ModerationData params={params} />
      </Suspense>
    </PageMain>
  );
}

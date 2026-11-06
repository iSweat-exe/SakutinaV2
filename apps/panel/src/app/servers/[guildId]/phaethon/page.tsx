import type { Metadata } from "next";
import { Suspense } from "react";
import { PhaethonData, PhaethonDataFallback } from "@/components/phaethon/phaethon-data";
import { PageMain } from "@/components/shell/page-main";

export const metadata: Metadata = { title: "Phaethon" };

export default function PhaethonPage({ params }: PageProps<"/servers/[guildId]/phaethon">) {
  return (
    <PageMain density="dense">
      <Suspense fallback={<PhaethonDataFallback />}>
        <PhaethonData params={params} />
      </Suspense>
    </PageMain>
  );
}

import type { Metadata } from "next";
import { PhaethonView } from "@/components/phaethon/phaethon-view";
import { PageMain } from "@/components/shell/page-main";

export const metadata: Metadata = { title: "Phaethon" };

export default function PhaethonPage() {
  return (
    <PageMain density="dense">
      <PhaethonView />
    </PageMain>
  );
}

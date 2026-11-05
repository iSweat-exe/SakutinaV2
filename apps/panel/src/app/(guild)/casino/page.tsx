import type { Metadata } from "next";
import { CasinoView } from "@/components/casino/casino-view";
import { PageMain } from "@/components/shell/page-main";

export const metadata: Metadata = { title: "Casino" };

export default function CasinoPage() {
  return (
    <PageMain>
      <CasinoView />
    </PageMain>
  );
}

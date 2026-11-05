import type { Metadata } from "next";
import { AntiRaidView } from "@/components/anti-raid/anti-raid-view";
import { PageMain } from "@/components/shell/page-main";

export const metadata: Metadata = { title: "Anti-Raid" };

export default function AntiRaidPage() {
  return (
    <PageMain>
      <AntiRaidView />
    </PageMain>
  );
}

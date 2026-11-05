import type { Metadata } from "next";
import { BalanceView } from "@/components/balance/balance-view";
import { PageMain } from "@/components/shell/page-main";

export const metadata: Metadata = { title: "Balance" };

export default function BalancePage() {
  return (
    <PageMain>
      <BalanceView />
    </PageMain>
  );
}

import type { Metadata } from "next";
import { PageMain } from "@/components/shell/page-main";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Casino" };

export default function CasinoPage() {
  return (
    <PageMain>
      <PageHeader title="Casino" description="Choose which games are open and how much members can bet." />
      <Notice icon="dice" title="The casino panel is not built yet">
        <p className="m-0">
          This page will let you open or close each game and set its bet limits. Nothing here can be changed yet.
        </p>
        <p className="m-0 mt-2">
          The games themselves already work on Discord: <strong className="font-semibold text-fg-soft">/casino slots</strong>,{" "}
          <strong className="font-semibold text-fg-soft">/casino blackjack</strong>,{" "}
          <strong className="font-semibold text-fg-soft">/casino roulette</strong> and{" "}
          <strong className="font-semibold text-fg-soft">/casino coinflip</strong>. Bets go from 10 coins up to a limit per game, and
          every result is written to the economy ledger.
        </p>
      </Notice>
    </PageMain>
  );
}

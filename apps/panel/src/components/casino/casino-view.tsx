"use client";

import { useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Locked } from "@/components/ui/locked";
import { MasterSwitch, PageHeader } from "@/components/ui/page-header";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { Switch } from "@/components/ui/switch";

type Game = Readonly<{ id: string; name: string; rtp: number; min: number; max: number }>;

// Sample casino shown (locked): the casino does not exist yet.
const GAMES: ReadonlyArray<Game> = [
  { id: "slots", name: "Slots", rtp: 96, min: 10, max: 500 },
  { id: "blackjack", name: "Blackjack", rtp: 99, min: 20, max: 2000 },
  { id: "roulette", name: "Roulette", rtp: 97, min: 10, max: 1000 },
  { id: "coinflip", name: "Coinflip", rtp: 98, min: 5, max: 250 },
];

const BETS = [
  { member: "Aiko", game: "Blackjack", bet: "500", result: "Won 500", win: true, when: "2 min ago" },
  { member: "Ren", game: "Slots", bet: "50", result: "Lost 50", win: false, when: "4 min ago" },
  { member: "Sora", game: "Roulette", bet: "200", result: "Won 400", win: true, when: "7 min ago" },
  { member: "Hana", game: "Coinflip", bet: "100", result: "Lost 100", win: false, when: "11 min ago" },
  { member: "Yuki", game: "Slots", bet: "25", result: "Lost 25", win: false, when: "14 min ago" },
] as const;

type Limits = Record<string, { on: boolean; min: number; max: number }>;

export function CasinoView() {
  const [open, setOpen] = useState(true);
  const [games, setGames] = useState<Limits>(
    Object.fromEntries(GAMES.map((g) => [g.id, { on: true, min: g.min, max: g.max }])),
  );
  const patch = (id: string, change: Partial<Limits[string]>) =>
    setGames((current) => ({ ...current, [id]: { ...current[id]!, ...change } }));

  return (
    <>
      <PageHeader
        title="Casino"
        description="Choose which games are open and how much members can bet."
        aside={
          <MasterSwitch label={open ? "Casino open" : "Casino closed"}>
            <Locked feature="casino" compact className="rounded-xl">
              <Switch label="Casino" checked={open} onChange={setOpen} />
            </Locked>
          </MasterSwitch>
        }
      />

      <Locked feature="casino" className="rounded-2xl">
        <StatGrid>
          <StatCard label="Wagered, 24 h" value="84,200" sub="312 bets from 61 members" />
          <StatCard label="Paid out, 24 h" value="79,650" sub="94.6% of what was wagered" />
          <StatCard label="House profit" value="4,550" sub="Coins taken out of circulation" />
          <StatCard label="Biggest win" value="12,000" sub="Slots, 3 hours ago" />
        </StatGrid>
      </Locked>

      <Locked feature="casino" as="section" aria-label="Games" className="grid gap-4 rounded-2xl [grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr))]">
        {GAMES.map((game) => {
          const state = games[game.id]!;

          return (
            <div key={game.id} className="flex flex-col gap-3.5 rounded-2xl border border-line bg-card px-[18px] pt-4 pb-[18px]">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <h2 className="m-0 font-display text-xl font-bold">{game.name}</h2>
                  <span className="text-[12.5px] text-muted">Pays back {game.rtp}%</span>
                </div>
                <Switch label={game.name} checked={state.on} onChange={(on) => patch(game.id, { on })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`min-${game.id}`} className="text-[13px] font-semibold">
                    Min bet
                  </label>
                  <input id={`min-${game.id}`} className="field" type="number" min={1} value={state.min} onChange={(e) => patch(game.id, { min: Number(e.target.value) })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`max-${game.id}`} className="text-[13px] font-semibold">
                    Max bet
                  </label>
                  <input id={`max-${game.id}`} className="field" type="number" min={1} value={state.max} onChange={(e) => patch(game.id, { max: Number(e.target.value) })} />
                </div>
              </div>
            </div>
          );
        })}
      </Locked>

      <Card lock="casino" labelledBy="h-bets" className="gap-3 px-5 pt-[18px] pb-2">
        <CardTitle id="h-bets">Recent bets</CardTitle>
        <DataTable head={["Member", "Game", "Bet", "Result", "When"]}>
          {BETS.map((bet) => (
            <tr key={`${bet.member}-${bet.when}`}>
              <td className="font-semibold">{bet.member}</td>
              <td>{bet.game}</td>
              <td>{bet.bet}</td>
              <td className={`font-semibold ${bet.win ? "text-success" : "text-danger"}`}>{bet.result}</td>
              <td className="text-muted">{bet.when}</td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </>
  );
}

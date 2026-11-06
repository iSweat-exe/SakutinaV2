"use client";

import { useState, useTransition } from "react";
import { saveCasinoGame, type SaveGameResult } from "@/app/servers/[guildId]/casino/actions";
import { Card, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { Stepper } from "@/components/ui/stepper";
import { Switch } from "@/components/ui/switch";
import { Tag } from "@/components/ui/tag";
import { number, short, signed } from "@/lib/format";
import type { IconName } from "@/lib/icons";
import type { Casino, CasinoGame, GameName } from "@/lib/panel-db/casino-schema";
import type { Modules } from "@/lib/panel-db/modules-schema";
import { useModules } from "@/components/modules/use-modules";
import { cn } from "@/lib/cn";

/** What each game is, as shown on its tile. */
const GAME_INFO: Record<GameName, Readonly<{ title: string; command: string; blurb: string; icon: IconName }>> = {
  slots: { title: "Slots", command: "/casino slots", blurb: "Three reels, up to 120 times the bet", icon: "dice" },
  blackjack: { title: "Blackjack", command: "/casino blackjack", blurb: "Against the dealer, blackjack pays 3 to 2", icon: "card" },
  roulette: { title: "Roulette", command: "/casino roulette", blurb: "European wheel: a colour, a half or a number", icon: "clock" },
  coinflip: { title: "Coinflip", command: "/casino coinflip", blurb: "Heads or tails, 49% chance to double", icon: "coin" },
};

const MESSAGES: Record<Extract<SaveGameResult, { ok: false }>["error"], string> = {
  forbidden: "Your Discord account cannot change this server's casino.",
  invalid: "That bet limit is out of range. Check it and try again.",
  unavailable: "The change could not be saved right now. Try again in a moment.",
};

type Notice = Readonly<{ tone: "ok" | "error"; text: string }>;

/** One game: open or closed, its maximum bet, and what it did in the last 24 h. Each change is saved on its own. */
function GameTile({
  guildId,
  game,
  casino,
  casinoOn,
  onSaved,
}: Readonly<{ guildId: string; game: CasinoGame; casino: Casino; casinoOn: boolean; onSaved: (casino: Casino) => void }>) {
  const info = GAME_INFO[game.game];
  const unit = casino.currencyName.toLowerCase();
  const [draft, setDraft] = useState(game.maxBet);
  const [pending, startSaving] = useTransition();
  const [notice, setNotice] = useState<Notice | null>(null);

  const dirty = draft !== game.maxBet;
  const valid = draft >= casino.minBet && draft <= casino.betCeiling;

  function save(change: Readonly<{ enabled?: boolean; maxBet?: number }>, done: string) {
    setNotice(null);
    startSaving(async () => {
      const result = await saveCasinoGame(guildId, game.game, change);

      if (result.ok) {
        onSaved(result.casino);
        setNotice({ tone: "ok", text: done });
      } else {
        setNotice({ tone: "error", text: MESSAGES[result.error] });
      }
    });
  }

  return (
    <div className="box-border flex flex-col gap-3.5 rounded-2xl border border-line bg-raised p-[18px] hover:border-line-strong">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex size-10 flex-none items-center justify-center rounded-xl border border-line-strong bg-selected">
          <Icon name={info.icon} size={20} className="text-accent" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="font-display text-[17px] font-bold">{info.title}</span>
          <span className="text-[12.5px] leading-snug text-muted">{info.blurb}</span>
        </div>
        <div className="flex flex-none items-center">
          <Tag className={game.enabled && casinoOn ? "text-fg" : "text-muted"}>{!casinoOn ? (game.enabled ? "Reopens" : "Closed") : game.enabled ? "Open" : "Closed"}</Tag>
          <Switch
            checked={game.enabled}
            label={`${info.title} is ${game.enabled ? "open" : "closed"}`}
            onChange={(next) =>
              !pending &&
              save({ enabled: next }, next ? `${info.title} is open.` : `${info.title} is closed. Members get a message instead of a game.`)
            }
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-fg-soft">Maximum bet</span>
        <Stepper
          label={`${info.title} maximum bet`}
          value={draft}
          step={50}
          max={casino.betCeiling}
          unit={unit}
          onChange={setDraft}
        />
        <span className="text-[12.5px] leading-snug text-muted">
          From {number(casino.minBet)} up to {number(draft)}. Default {number(game.defaultMaxBet)}, never more than {number(casino.betCeiling)}.
          {game.coveredBet !== null && game.coveredBet < draft ? (
            <>
              {" "}
              The casino account covers <span className="font-semibold text-fg">{number(game.coveredBet)}</span> for now: the bot refuses more.
            </>
          ) : null}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!dirty || !valid || pending}
          onClick={() => save({ maxBet: draft }, `${info.title} now accepts bets up to ${number(draft)} ${unit}.`)}
          className="min-h-11 cursor-pointer rounded-xl border border-transparent bg-accent px-5 text-sm font-semibold text-on-accent hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {pending ? "Saving…" : "Save limit"}
        </button>
        {dirty && !pending ? (
          <button
            type="button"
            onClick={() => {
              setDraft(game.maxBet);
              setNotice(null);
            }}
            className="min-h-11 cursor-pointer rounded-xl border border-line-strong bg-transparent px-4 text-sm font-semibold text-fg-soft hover:border-accent"
          >
            Discard
          </button>
        ) : null}
        <span role="status" className={`text-[13px] ${notice?.tone === "error" ? "text-danger" : "text-muted"}`}>
          {notice?.text ?? (dirty && !valid ? `The minimum bet is ${number(casino.minBet)}.` : "")}
        </span>
      </div>

      <p className="m-0 border-t border-divider pt-3 text-[12.5px] text-muted">
        {game.rounds24h === 0
          ? `No rounds in the last 24 h · ${info.command}`
          : `${number(game.rounds24h)} ${game.rounds24h === 1 ? "round" : "rounds"} in the last 24 h · casino ${game.houseNet24h === 0 ? "even" : `${signed(game.houseNet24h)} ${unit}`}`}
      </p>
    </div>
  );
}

/** The four games and their limits, then what the casino did in the last 24 h. */
export function CasinoView({ guildId, casino: initial, modules: initialModules }: Readonly<{ guildId: string; casino: Casino; modules: Modules }>) {
  const [casino, setCasino] = useState(initial);
  const { modules, toggle, error: switchError, pending: switching } = useModules(guildId, initialModules);
  const on = modules.casino;
  // The general switch sits above the per-game settings: off, every game is closed whatever its own setting.
  const open = on ? casino.games.filter((game) => game.enabled).length : 0;
  const rounds = casino.games.reduce((sum, game) => sum + game.rounds24h, 0);
  const net = casino.games.reduce((sum, game) => sum + game.houseNet24h, 0);
  const unit = casino.currencyName.toLowerCase();

  return (
    <>
      <Card label="Casino switch" className={cn("flex-row flex-wrap items-center justify-between gap-3 px-5 py-3.5", !on && "border-warning")}>
        <div className="flex flex-col gap-0.5">
          <span className="text-[15px] font-semibold">{on ? "The casino is open" : "The casino is closed for everyone"}</span>
          <span className="text-[12.5px] text-muted">
            {on
              ? "Switch it off to close every game at once. Each game keeps its own setting for when you reopen."
              : "Every game refuses new bets. Turning it back on reopens the games that were open before."}
          </span>
          {switchError ? <span className="text-[12.5px] text-danger">{switchError}</span> : null}
        </div>
        <Switch label={on ? "Casino open" : "Casino closed"} checked={on} onChange={(next) => !switching && toggle("casino", next)} />
      </Card>

      <StatGrid>
        <StatCard label="Games open" value={`${open} of ${casino.games.length}`} sub={!on ? "Casino switched off" : open === 0 ? "The casino is closed" : "Members can play these now"} />
        <StatCard label="Rounds, last 24 h" value={short(rounds)} sub="All four games together" />
        <StatCard
          label="Casino result, last 24 h"
          value={net === 0 ? "0" : signed(net)}
          sub={net > 0 ? `The casino account kept ${short(net)} ${unit} from the games` : net < 0 ? `The casino account paid ${short(-net)} ${unit} in winnings` : "Stakes and winnings cancel out"}
        />
      </StatGrid>

      <Card labelledBy="h-games" className="gap-4 px-5 pt-[18px] pb-[22px]">
        <div className="flex flex-col gap-1">
          <CardTitle id="h-games">Games</CardTitle>
          <p className="m-0 max-w-[72ch] text-[12.5px] leading-snug text-muted">
            Every bet is at least {number(casino.minBet)} {unit}. A closed game refuses new bets; hands already in progress finish. The bot applies a change
            within seconds. Lost bets go to the casino account (5% to the jackpot), which pays the winnings and never goes below zero.
          </p>
        </div>
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr))]">
          {casino.games.map((game) => (
            <GameTile key={game.game} guildId={guildId} game={game} casino={casino} casinoOn={on} onSaved={setCasino} />
          ))}
        </div>
      </Card>
    </>
  );
}

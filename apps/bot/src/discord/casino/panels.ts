import { encodeId } from "@/discord/components/custom-id.ts";
import { formatCoins, formatShort } from "@/discord/formatting.ts";
import { messages } from "@/discord/messages.ts";
import { button, buttonRow } from "@/discord/ui/controls.ts";
import { createPanel, type Panel } from "@/discord/ui/panels.ts";
import { canDouble, totalOf, type Card, type Hand, type Outcome, type Round } from "@/domain/casino/blackjack.ts";
import type { Played } from "@/domain/casino/casino-service.ts";
import type { CoinflipResult, Side } from "@/domain/casino/coinflip.ts";
import { colorOf, type RouletteBet, type RouletteResult } from "@/domain/casino/roulette.ts";
import { TRIPLE, type SlotsResult } from "@/domain/casino/slots.ts";

const text = messages.casino;

/** « Gagné +160 pièces », « Perdu −100 pièces » ou « Mise rendue ». */
function outcomeLine(net: number, currency: string): string {
  if (net > 0) return text.won(formatCoins(net, currency));
  if (net < 0) return text.lost(formatCoins(-net, currency));

  return text.even;
}

/** Fin d'un jeu : le résultat net, puis en petit la mise et ce qu'il reste. */
const settled = (bet: number, net: number, wallet: number, currency: string) =>
  [outcomeLine(net, currency), text.stake(formatShort(bet), formatShort(wallet))].join("\n");

/** Gagné : bandeau de succès ; perdu ou égalité : couleur de la catégorie, sans alarmer. */
const toneOf = (net: number) => (net > 0 ? ("success" as const) : undefined);

export function slotsPanel(played: Played<SlotsResult>, currency: string): Panel {
  const { reels } = played.result;
  const names = reels.map((symbol) => text.symbols[symbol]).join("  ·  ");
  const [a, b, c] = reels;
  const note = a === b && b === c ? text.slots.triple(TRIPLE[a]) : played.result.payout > 0 ? text.slots.cherries : undefined;

  return createPanel({
    category: "casino",
    tone: toneOf(played.net),
    title: text.slots.title,
    description: [text.slots.reels(names), note, settled(played.bet, played.net, played.account.wallet, currency)].filter(Boolean).join("\n"),
  });
}

export function coinflipPanel(played: Played<CoinflipResult>, chosen: Side, currency: string): Panel {
  const label = (side: Side) => text.coinflip[side];

  return createPanel({
    category: "casino",
    tone: toneOf(played.net),
    title: text.coinflip.title,
    description: [
      text.coinflip.landed(label(played.result.landed), label(chosen)),
      settled(played.bet, played.net, played.account.wallet, currency),
    ].join("\n"),
  });
}

export function roulettePanel(played: Played<RouletteResult>, on: RouletteBet, currency: string): Panel {
  const choice = on.kind === "number" ? `${text.roulette.choices.number} ${on.number}` : text.roulette.choices[on.kind];
  const { pocket } = played.result;

  return createPanel({
    category: "casino",
    tone: toneOf(played.net),
    title: text.roulette.title,
    description: [
      text.roulette.landed(pocket, text.roulette.colors[colorOf(pocket)]),
      text.roulette.betOn(choice),
      settled(played.bet, played.net, played.account.wallet, currency),
    ].join("\n"),
  });
}

const showCard = (card: Card) => `${card.rank}${card.suit}`;
const showHand = (hand: Hand) => hand.map(showCard).join(" ");

/** Où en est la main : en cours (boutons sous le panneau), terminée (résultat et gain). */
export type BlackjackView =
  | Readonly<{ state: "playing"; round: Round; gameId: string; ownerId: string; currency: string }>
  | Readonly<{
      state: "finished";
      round: Round;
      outcome: Outcome;
      net: number;
      wallet: number;
      currency: string;
      note?: string;
    }>;

export function blackjackPanel(view: BlackjackView): Panel {
  const { round, currency } = view;
  const t = text.blackjack;
  const player = `${showHand(round.player)} — ${t.total(totalOf(round.player).total)}`;

  if (view.state === "playing") {
    // Pendant la main, la deuxième carte du croupier reste cachée.
    const [upCard] = round.dealer;
    const dealer = `${upCard ? showCard(upCard) : ""} ?`;
    const ids = (action: string) => encodeId("bj", action, view.ownerId, view.gameId);

    return createPanel({
      category: "casino",
      title: t.title,
      description: [t.hands(player, dealer), `-# Mise ${formatShort(round.bet)}`].join("\n"),
      rows: [
        buttonRow(
          button({ id: ids("hit"), label: t.hit, intent: "primary" }),
          button({ id: ids("stand"), label: t.stand, intent: "neutral" }),
          button({ id: ids("double"), label: t.double, intent: "neutral", disabled: !canDouble(round) }),
        ),
      ],
    });
  }

  const dealer = `${showHand(round.dealer)} — ${t.total(totalOf(round.dealer).total)}`;

  return createPanel({
    category: "casino",
    tone: view.outcome === "blackjack" || view.outcome === "win" ? "success" : undefined,
    title: t.title,
    description: [
      t.hands(player, dealer),
      `**${t.outcomes[view.outcome]}** · ${outcomeLine(view.net, currency)}`,
      view.note ? `-# ${view.note}` : null,
      text.stake(formatShort(round.bet), formatShort(view.wallet)),
    ]
      .filter((line): line is string => line !== null)
      .join("\n"),
  });
}

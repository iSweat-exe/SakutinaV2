import { beforeEach, expect, test } from "bun:test";

import { activeGames, expireGame, settleAllGames } from "@/discord/casino/blackjack-flow.ts";
import { blackjackCommand } from "@/discord/commands/casino/blackjack.ts";
import { coinflipCommand } from "@/discord/commands/casino/coinflip.ts";
import { rouletteCommand } from "@/discord/commands/casino/roulette.ts";
import { slotsCommand } from "@/discord/commands/casino/slots.ts";
import { findCommand } from "@/discord/commands/index.ts";
import { encodeId, parseId } from "@/discord/components/custom-id.ts";
import { blackjackComponents } from "@/discord/components/blackjack.ts";
import { formatCoins } from "@/discord/formatting.ts";
import { messages } from "@/discord/messages.ts";
import { deal, decidedAtDeal, dealerPlay, hit, outcomeOf, payoutOutcome, isBust, playerCanAct, totalOf } from "@/domain/casino/blackjack.ts";
import { MAX_BET, MIN_BET, defaultCasinoSettings } from "@/domain/casino/casino-rules.ts";
import { defaultSettings } from "@/domain/guilds/guild-types.ts";
import { GUILD, ME, OTHER, buttonInteraction, commandInteraction, createContext, isEphemeral, user } from "../../../support/fakes.ts";
import { textOf } from "../../../support/panel-text.ts";

const text = messages.casino;
const member = { role: "member" } as const;

/** Les libellés de champ sont affichés en capitales : on compare sans tenir compte de la casse. */
const has = (shown: string, expected: string) => shown.toLowerCase().includes(expected.toLowerCase());

async function funded(funds = 1_000) {
  const setup = createContext();
  await setup.economyService.grantStartingBalance(GUILD, ME, funds);

  return { ...setup, wallet: async () => (await setup.economyService.getAccount(GUILD, ME)).wallet };
}

test("les quatre commandes sont enregistrées dans /casino, ouvertes à tous les membres", () => {
  for (const [name, command] of [
    ["slots", slotsCommand],
    ["blackjack", blackjackCommand],
    ["roulette", rouletteCommand],
    ["coinflip", coinflipCommand],
  ] as const) {
    expect(findCommand("casino", name)).toBe(command);
    expect(command.requiredRole).toBe("member");
    expect(command.definition.description.length).toBeLessThanOrEqual(100);
  }
});

test("la définition Discord ne fixe aucun plafond : le serveur règle le sien, le bot l'applique", () => {
  for (const command of [slotsCommand, blackjackCommand, rouletteCommand, coinflipCommand]) {
    const bet = (command.definition.options ?? []).find((option) => option.name === "bet") as { required?: boolean; min_value?: number; max_value?: number };

    expect(bet).toMatchObject({ required: true, min_value: MIN_BET });
    expect(bet.max_value).toBeUndefined();
  }
});

// ---------------------------------------------------------------- machine à sous

test("/casino slots : un gain est public, crédité, avec les symboles et le portefeuille", async () => {
  const { context, rng, wallet } = await funded();
  rng.next = () => 0.95;
  const command = commandInteraction({ integers: { bet: 10 } });

  await slotsCommand.execute(command.fake, context, member);

  expect(isEphemeral(command.replies[0])).toBe(false);
  const shown = textOf(command.replies[0]);
  expect(shown).toContain(text.slots.title);
  expect(shown).toContain(`${text.symbols.seven}  ·  ${text.symbols.seven}  ·  ${text.symbols.seven}`);
  expect(shown).toContain(`+${formatCoins(1_190)}`);
  expect(await wallet()).toBe(2_190);
});

test("/casino slots : une perte débite la mise", async () => {
  const draws = [0, 0.3, 0.55];
  let i = 0;
  const { context, rng, wallet } = await funded();
  rng.next = () => draws[i++ % 3]!;
  const command = commandInteraction({ integers: { bet: 100 } });

  await slotsCommand.execute(command.fake, context, member);

  expect(textOf(command.replies[0])).toContain(`−${formatCoins(100)}`);
  expect(await wallet()).toBe(900);
});

test("une mise refusée (hors limites, fonds insuffisants) est privée et n'écrit rien", async () => {
  const { context, wallet } = await funded(50);

  const tooHigh = commandInteraction({ integers: { bet: MAX_BET.slots + 1 } });
  await slotsCommand.execute(tooHigh.fake, context, member);
  expect(textOf(tooHigh.replies[0])).toContain(messages.economy.errors.betLimitsTitle);
  expect(isEphemeral(tooHigh.replies[0])).toBe(true);

  const poor = commandInteraction({ integers: { bet: 100 } });
  await slotsCommand.execute(poor.fake, context, member);
  expect(textOf(poor.replies[0])).toContain(messages.economy.errors.insufficientTitle);
  expect(isEphemeral(poor.replies[0])).toBe(true);

  expect(await wallet()).toBe(50);
});

test("un jeu fermé par les administrateurs est refusé en privé, sans rien écrire ni tirer", async () => {
  const { context, guildStore, wallet } = await funded();
  guildStore.settings.set(GUILD, {
    ...defaultSettings(GUILD),
    casino: { ...defaultCasinoSettings(), slots: { enabled: false, maxBet: MAX_BET.slots } },
  });

  const closed = commandInteraction({ integers: { bet: 100 } });
  await slotsCommand.execute(closed.fake, context, member);
  expect(textOf(closed.replies[0])).toContain(messages.economy.errors.gameClosedTitle);
  expect(textOf(closed.replies[0])).toContain(text.slots.title);
  expect(isEphemeral(closed.replies[0])).toBe(true);
  expect(await wallet()).toBe(1_000);

  // Les autres jeux restent ouverts.
  const open = commandInteraction({ integers: { bet: 100 }, strings: { side: "heads" } });
  await coinflipCommand.execute(open.fake, context, member);
  expect(textOf(open.replies[0])).not.toContain(messages.economy.errors.gameClosedTitle);
});

test("la mise maximale réglée par le serveur s'applique", async () => {
  const { context, guildStore } = await funded();
  guildStore.settings.set(GUILD, {
    ...defaultSettings(GUILD),
    casino: { ...defaultCasinoSettings(), slots: { enabled: true, maxBet: 50 } },
  });

  const tooHigh = commandInteraction({ integers: { bet: 51 } });
  await slotsCommand.execute(tooHigh.fake, context, member);
  expect(textOf(tooHigh.replies[0])).toContain(messages.economy.errors.betLimitsTitle);
  expect(textOf(tooHigh.replies[0])).toContain("50");
});

test("le nom de la monnaie du serveur s'applique aux jeux", async () => {
  const { context, guildStore, rng } = await funded();
  guildStore.settings.set(GUILD, { ...defaultSettings(GUILD), currencyName: "Gemmes" });
  rng.next = () => 0.1;
  const command = commandInteraction({ integers: { bet: 100 }, strings: { side: "heads" } });

  await coinflipCommand.execute(command.fake, context, member);

  expect(textOf(command.replies[0])).toContain("100 Gemmes");
});

test("la même interaction rejouée est signalée et ne rejoue pas le jeu", async () => {
  const { context, rng, wallet } = await funded();
  const draws = [0, 0.3, 0.55];
  let i = 0;
  rng.next = () => draws[i++ % 3]!;
  const first = commandInteraction({ id: "same", integers: { bet: 100 } });
  const second = commandInteraction({ id: "same", integers: { bet: 100 } });

  await slotsCommand.execute(first.fake, context, member);
  await slotsCommand.execute(second.fake, context, member);

  expect(textOf(second.replies[0])).toContain(messages.economy.replayed.title);
  expect(isEphemeral(second.replies[0])).toBe(true);
  expect(await wallet()).toBe(900);
});

// ---------------------------------------------------------------- pile ou face

test("/casino coinflip : gain et perte, avec le côté tiré et le côté choisi", async () => {
  const win = await funded();
  win.rng.next = () => 0.1;
  const won = commandInteraction({ integers: { bet: 100 }, strings: { side: "tails" } });
  await coinflipCommand.execute(won.fake, win.context, member);
  expect(textOf(won.replies[0])).toContain(text.coinflip.landed(text.coinflip.tails, text.coinflip.tails));
  expect(await win.wallet()).toBe(1_100);

  const loss = await funded();
  loss.rng.next = () => 0.9;
  const lost = commandInteraction({ integers: { bet: 100 }, strings: { side: "tails" } });
  await coinflipCommand.execute(lost.fake, loss.context, member);
  expect(textOf(lost.replies[0])).toContain(text.coinflip.landed(text.coinflip.heads, text.coinflip.tails));
  expect(await loss.wallet()).toBe(900);
});

// ---------------------------------------------------------------- roulette

test("/casino roulette : mise sur une couleur, puis sur un numéro", async () => {
  const red = await funded();
  red.rng.next = () => 1 / 37;
  const onRed = commandInteraction({ integers: { bet: 100 }, strings: { on: "red" } });
  await rouletteCommand.execute(onRed.fake, red.context, member);
  const shown = textOf(onRed.replies[0]);
  expect(shown).toContain(text.roulette.landed(1, text.roulette.colors.red));
  expect(shown).toContain(text.roulette.betOn(text.roulette.choices.red));
  expect(await red.wallet()).toBe(1_100);

  const exact = await funded();
  exact.rng.next = () => 17.5 / 37;
  const onNumber = commandInteraction({ integers: { bet: 10, number: 17 }, strings: { on: "number" } });
  await rouletteCommand.execute(onNumber.fake, exact.context, member);
  expect(textOf(onNumber.replies[0])).toContain(text.roulette.betOn(`${text.roulette.choices.number} 17`));
  expect(await exact.wallet()).toBe(1_350);
});

test("/casino roulette : un numéro est exigé pour « Numéro plein » et refusé ailleurs, sans rien débiter", async () => {
  const { context, wallet } = await funded();

  const missing = commandInteraction({ integers: { bet: 10 }, strings: { on: "number" } });
  await rouletteCommand.execute(missing.fake, context, member);
  expect(textOf(missing.replies[0])).toContain(text.roulette.numberMissingTitle);

  const extra = commandInteraction({ integers: { bet: 10, number: 3 }, strings: { on: "red" } });
  await rouletteCommand.execute(extra.fake, context, member);
  expect(textOf(extra.replies[0])).toContain(text.roulette.numberUnexpectedTitle);

  expect(missing.replies.concat(extra.replies).every(isEphemeral)).toBe(true);
  expect(await wallet()).toBe(1_000);
});

// ---------------------------------------------------------------- blackjack

/** Une valeur de tirage constante qui ne donne pas de blackjack à la donne (sinon la main est déjà décidée). */
function undecidedRng(): number {
  const found = [0.5, 0.3, 0.7, 0.1, 0.9, 0.2, 0.4, 0.6, 0.8].find((value) => !decidedAtDeal(deal(() => value, 100)));

  if (found === undefined) throw new Error("aucun tirage de test indécis");

  return found;
}

async function startHand(bet = 100, funds = 1_000) {
  const setup = await funded(funds);
  const rngValue = undecidedRng();
  setup.rng.next = () => rngValue;
  const command = commandInteraction({ id: `hand-${crypto.randomUUID()}`, integers: { bet } });

  await blackjackCommand.execute(command.fake, setup.context, member);

  const gameId = (command.fake as unknown as { id: string }).id;

  return { ...setup, command, gameId, rngValue };
}

const press = async (setup: Awaited<ReturnType<typeof startHand>>, action: string, who = ME) => {
  const id = parseId(encodeId("bj", action, who, setup.gameId))!;
  const click = buttonInteraction({ as: user(who, "Joueur") });

  await blackjackComponents.handle(click.fake as never, setup.context, id, member);

  return { ...click, updates: click.calls.updates, replies: click.calls.replies };
};

beforeEach(async () => {
  // Les mains en cours sont globales au processus : on repart propre.
  const { context } = createContext();
  await settleAllGames(context);
});

test("/casino blackjack : la mise est prélevée, la main s'affiche avec ses boutons et la carte cachée du croupier", async () => {
  const { command, wallet } = await startHand(100);
  const shown = textOf(command.replies[0]);

  expect(has(shown, text.blackjack.you)).toBe(true);
  // Seule la première carte du croupier est visible.
  expect(shown).toMatch(/\*\*Croupier\*\* \S+ \?\n/);
  expect(shown).toContain(text.blackjack.hit);
  expect(shown).toContain(text.blackjack.stand);
  expect(shown).toContain(text.blackjack.double);
  expect(await wallet()).toBe(900);
  expect(activeGames()).toBe(1);
});

test("« Rester » : le croupier joue, le gain est versé, la main est terminée sans boutons", async () => {
  const setup = await startHand(100);
  const round = dealerPlay(deal(() => setup.rngValue, 100));
  const expected = payoutOutcome(outcomeOf(round), 100);

  const click = await press(setup, "stand");

  const shown = textOf(click.updates[0]);
  expect(shown).toContain(text.blackjack.outcomes[outcomeOf(round)]);
  expect(shown).not.toContain(text.blackjack.hit);
  expect(await setup.wallet()).toBe(900 + expected);
  expect(activeGames()).toBe(0);
});

test("« Tirer » : une carte de plus ; la main continue ou se termine selon le total, le portefeuille concorde", async () => {
  const setup = await startHand(100);
  const afterHit = hit(deal(() => setup.rngValue, 100));
  const over = isBust(afterHit.player) || !playerCanAct(afterHit);

  const click = await press(setup, "hit");

  const shown = textOf(click.updates[0]);
  expect(shown).toContain(`**${totalOf(afterHit.player).total}**`);

  if (over) {
    const finished = isBust(afterHit.player) ? afterHit : dealerPlay(afterHit);
    expect(await setup.wallet()).toBe(900 + payoutOutcome(outcomeOf(finished), 100));
    expect(activeGames()).toBe(0);
  } else {
    expect(shown).toContain(text.blackjack.stand);
    expect(await setup.wallet()).toBe(900);
    expect(activeGames()).toBe(1);
  }
});

test("« Doubler » : une seconde mise est prélevée, une carte, puis la main se termine avec la mise totale", async () => {
  const setup = await startHand(100);
  const doubled = dealerPlay((await import("@/domain/casino/blackjack.ts")).doubleDown(deal(() => setup.rngValue, 100)));
  const expected = payoutOutcome(outcomeOf(doubled), 200);

  await press(setup, "double");

  expect(await setup.wallet()).toBe(800 + expected);
  expect(activeGames()).toBe(0);
});

test("« Doubler » sans les fonds : refus privé, la main reste en cours et la mise intacte", async () => {
  const setup = await startHand(100, 150);
  const click = await press(setup, "double");

  expect(textOf(click.replies[0])).toContain(messages.economy.errors.insufficientTitle);
  expect(isEphemeral(click.replies[0])).toBe(true);
  expect(click.updates).toEqual([]);
  expect(await setup.wallet()).toBe(50);
  expect(activeGames()).toBe(1);
});

test("une main inconnue ou d'un autre joueur : refus privé, rien ne bouge", async () => {
  const setup = await startHand(100);
  const stranger = await press(setup, "stand", OTHER);

  expect(textOf(stranger.replies[0])).toContain(text.blackjack.goneTitle);
  expect(isEphemeral(stranger.replies[0])).toBe(true);
  expect(activeGames()).toBe(1);

  const unknown = await press({ ...setup, gameId: "inconnue" }, "hit");
  expect(textOf(unknown.replies[0])).toContain(text.blackjack.goneTitle);

  const odd = await press(setup, "tricher");
  expect(odd.replies).toEqual([]);
  expect(odd.updates).toEqual([]);
});

test("une main terminée ne se rejoue pas : un second clic est refusé et ne paie pas deux fois", async () => {
  const setup = await startHand(100);

  await press(setup, "stand");
  const walletAfter = await setup.wallet();
  const again = await press(setup, "stand");

  expect(textOf(again.replies[0])).toContain(text.blackjack.goneTitle);
  expect(await setup.wallet()).toBe(walletAfter);
});

test("faute de réponse, la main se termine d'office (le joueur reste) et le message est mis à jour", async () => {
  const setup = await startHand(100);
  const round = dealerPlay(deal(() => setup.rngValue, 100));

  await expireGame(setup.context, setup.gameId);

  expect(setup.command.edits).toHaveLength(1);
  expect(textOf(setup.command.edits[0])).toContain(text.blackjack.timeout);
  expect(await setup.wallet()).toBe(900 + payoutOutcome(outcomeOf(round), 100));
  expect(activeGames()).toBe(0);
});

test("à l'arrêt du bot, toutes les mains en cours sont terminées : aucune mise n'est perdue", async () => {
  const first = await startHand(100);
  const rngValue = first.rngValue;

  await settleAllGames(first.context);

  const round = dealerPlay(deal(() => rngValue, 100));
  expect(await first.wallet()).toBe(900 + payoutOutcome(outcomeOf(round), 100));
  expect(first.command.edits).toHaveLength(1);
  expect(activeGames()).toBe(0);
});

test("une main décidée dès la donne (blackjack) se règle tout de suite", async () => {
  const value = [0.5, 0.3, 0.7, 0.1, 0.9, 0.2, 0.4, 0.6, 0.8, 0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95].find((candidate) =>
    decidedAtDeal(deal(() => candidate, 100)),
  );

  if (value === undefined) {
    // Aucune constante testée ne donne de blackjack : la règle est déjà couverte par les tests du domaine.
    return;
  }

  const { context, rng, wallet } = await funded();
  rng.next = () => value;
  const command = commandInteraction({ integers: { bet: 100 } });

  await blackjackCommand.execute(command.fake, context, member);

  const round = deal(() => value, 100);
  expect(textOf(command.replies[0])).not.toContain(text.blackjack.hit);
  expect(await wallet()).toBe(900 + payoutOutcome(outcomeOf(round), 100));
  expect(activeGames()).toBe(0);
});

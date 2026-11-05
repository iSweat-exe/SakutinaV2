import { expect, test } from "bun:test";

import { buildBalancePanel } from "@/discord/commands/economy/balance-panel.ts";
import { HISTORY_PAGE_SIZE } from "@/discord/commands/economy/history-panel.ts";
import { balanceCommand } from "@/discord/commands/economy/balance.ts";
import { historyCommand } from "@/discord/commands/economy/history.ts";
import { forgetMeCommand } from "@/discord/commands/tracking/forgetme.ts";
import { leaderboardCommand } from "@/discord/commands/tracking/leaderboard.ts";
import { statsCommand } from "@/discord/commands/tracking/stats.ts";
import { balanceComponents, parseAmount } from "@/discord/components/balance.ts";
import { forgetComponents } from "@/discord/components/forget.ts";
import { historyComponents } from "@/discord/components/history.ts";
import { componentHandlers, findComponentHandler } from "@/discord/components/index.ts";
import { parseId } from "@/discord/components/custom-id.ts";
import { leaderboardComponents } from "@/discord/components/leaderboard.ts";
import { statsComponents } from "@/discord/components/stats.ts";
import type { ComponentHandler } from "@/discord/components/handler.ts";
import { messages } from "@/discord/messages.ts";
import { emptyAccount } from "@/domain/economy/economy-types.ts";
import {
  GUILD,
  ME,
  OTHER,
  buttonInteraction,
  commandInteraction,
  createContext,
  isEphemeral,
  modalInteraction,
  selectInteraction,
  user,
} from "../../support/fakes.ts";
import { buttonsOf, findButton, textOf } from "../../support/panel-text.ts";

type Role = "member" | "admin";

/** Appelle un gestionnaire comme le routeur : identifiant d'abord, puis rôle de l'utilisateur. */
async function press(
  handler: ComponentHandler,
  interaction: Parameters<ComponentHandler["handle"]>[0],
  context: Parameters<ComponentHandler["handle"]>[1],
  customId: string,
  role: Role = "member",
) {
  const id = parseId(customId);

  if (!id) throw new Error(`bad id ${customId}`);

  await handler.handle(interaction, context, id, { role });
}

test("chaque espace de noms a exactement un gestionnaire", () => {
  const namespaces = componentHandlers.map((handler) => handler.namespace);

  expect(new Set(namespaces).size).toBe(namespaces.length);
  expect(namespaces.sort()).toEqual(["ba", "fg", "hi", "lb", "st"]);
  expect(findComponentHandler("zz")).toBeUndefined();
});

// ---------------------------------------------------------------- classement

test("un administrateur change de période : le message est mis à jour sur place", async () => {
  const { context } = createContext();
  const first = commandInteraction({ strings: { category: "messages" } });
  await leaderboardCommand.execute(first.fake, context, { role: "admin" });

  const days = buttonsOf(first.calls.replies[0]).map((node) => node.custom_id);
  expect(days).toEqual([`lb:days:${ME}:messages:1`, `lb:days:${ME}:messages:7`, `lb:days:${ME}:messages:30`]);

  const click = buttonInteraction({ ephemeralMessage: true });
  await press(leaderboardComponents, click.fake, context, `lb:days:${ME}:messages:30`, "admin");

  expect(click.calls.updates).toHaveLength(1);
  expect(click.calls.replies).toHaveLength(0);
  expect(textOf(click.calls.updates[0])).toContain("30 derniers jours");
});

test("un menu change de classement ; un membre ne voit que « Richesse »", async () => {
  const { context } = createContext();
  const member = commandInteraction({ strings: { category: "economy" } });
  await leaderboardCommand.execute(member.fake, context, { role: "member" });
  expect(textOf(member.calls.replies[0])).toContain("Richesse");
  expect(textOf(member.calls.replies[0])).not.toContain("Temps vocal");

  const admin = commandInteraction({ strings: { category: "economy" } });
  await leaderboardCommand.execute(admin.fake, context, { role: "admin" });
  expect(textOf(admin.calls.replies[0])).toContain("Temps vocal");
});

test("un membre qui force un classement d'activité via le menu est refusé", async () => {
  const { context } = createContext();
  const select = selectInteraction({ values: ["messages"] });

  await press(leaderboardComponents, select.fake, context, `lb:category:${ME}`, "member");

  expect(select.calls.updates).toHaveLength(0);
  expect(isEphemeral(select.calls.replies[0])).toBe(true);
  expect(textOf(select.calls.replies[0])).toContain(messages.errors.adminOnly);
});

test("un classement d'activité n'écrase jamais un message public : il est envoyé en privé", async () => {
  const { context } = createContext();
  // Message public (classement de richesse) : l'administrateur choisit « Messages ».
  const select = selectInteraction({ values: ["messages"], ephemeralMessage: false });

  await press(leaderboardComponents, select.fake, context, `lb:category:${ME}`, "admin");

  expect(select.calls.updates).toHaveLength(0);
  expect(select.calls.replies).toHaveLength(1);
  expect(isEphemeral(select.calls.replies[0])).toBe(true);
  expect(textOf(select.calls.replies[0])).toContain(`<@${OTHER}>`);
});

// ------------------------------------------------------------------- stats

test("/me stats propose les périodes 7 j et 30 j, la sélectionnée en bleu", async () => {
  const { context } = createContext();
  const command = commandInteraction({});
  await statsCommand.execute(command.fake, context, { role: "member" });
  const sent = command.calls.replies[0];

  expect(isEphemeral(sent)).toBe(true);
  expect(findButton(sent, "30 j")?.style).toBe(1); // Primary
  expect(findButton(sent, "7 j")?.style).toBe(2); // Secondary
  expect(findButton(sent, "7 j")?.custom_id).toBe(`st:days:${ME}:${ME}:7`);
});

test("changer de période sur ses propres statistiques met à jour le message", async () => {
  const { context } = createContext();
  const click = buttonInteraction({});

  await press(statsComponents, click.fake, context, `st:days:${ME}:${ME}:7`);

  expect(click.calls.updates).toHaveLength(1);
  expect(textOf(click.calls.updates[0])).toContain("7 derniers jours");
  expect(textOf(click.calls.updates[0])).toContain("**1** messages");
});

test("un membre ne peut pas lire les statistiques d'un autre en forgeant le bouton", async () => {
  const { context } = createContext();
  const click = buttonInteraction({});

  await press(statsComponents, click.fake, context, `st:days:${ME}:${OTHER}:7`, "member");

  expect(click.calls.updates).toHaveLength(0);
  expect(textOf(click.calls.replies[0])).toContain(messages.errors.adminOnly);

  const admin = buttonInteraction({});
  await press(statsComponents, admin.fake, context, `st:days:${ME}:${OTHER}:7`, "admin");
  expect(textOf(admin.calls.updates[0])).toContain("**2** messages");
});

test("une période inconnue est ignorée", async () => {
  const { context } = createContext();
  const click = buttonInteraction({});

  await press(statsComponents, click.fake, context, `st:days:${ME}:${ME}:999`);

  expect(click.calls.updates).toHaveLength(0);
  expect(click.calls.replies).toHaveLength(0);
});

// -------------------------------------------------------------- historique

test("l'historique se pagine : « Suivant » n'apparaît que s'il reste des entrées", async () => {
  const { context, economyService } = createContext();
  const first = commandInteraction({});
  await historyCommand.execute(first.fake, context, { role: "member" });
  expect(textOf(first.calls.replies[0])).toContain(messages.economy.history.empty);
  expect(buttonsOf(first.calls.replies[0])).toHaveLength(0);

  // 8 entrées par page : 11 dépôts → 2 pages.
  await economyService.daily(GUILD, ME, "d");
  for (let index = 0; index < HISTORY_PAGE_SIZE + 2; index++) {
    await economyService.deposit(GUILD, ME, 1, `dep-${index}`);
  }

  const page1 = commandInteraction({});
  await historyCommand.execute(page1.fake, context, { role: "member" });
  const sent = page1.calls.replies[0];

  expect(findButton(sent, messages.controls.previous)?.disabled).toBe(true);
  expect(findButton(sent, messages.controls.next)?.disabled).toBe(false);
  expect(findButton(sent, messages.controls.next)?.custom_id).toBe(`hi:page:${ME}:2`);
  expect(textOf(sent)).toContain("Page 1");

  const click = buttonInteraction({});
  await press(historyComponents, click.fake, context, `hi:page:${ME}:2`);
  const next = click.calls.updates[0];

  expect(textOf(next)).toContain("Page 2");
  expect(findButton(next, messages.controls.next)?.disabled).toBe(true);
  expect(findButton(next, messages.controls.previous)?.disabled).toBe(false);
});

test("l'historique affiché est celui du propriétaire du message, pas d'un identifiant forgé", async () => {
  const { context, economyService } = createContext();
  await economyService.daily(GUILD, OTHER, "other-daily");

  const click = buttonInteraction({});
  await press(historyComponents, click.fake, context, `hi:page:${ME}:1`);

  expect(textOf(click.calls.updates[0])).toContain(messages.economy.history.empty);
});

// ------------------------------------------------------------------- solde

test("le solde d'un membre propose des boutons, désactivés quand ils n'ont rien à faire", async () => {
  const { context, economyService } = createContext();
  const empty = commandInteraction({});
  await balanceCommand.execute(empty.fake, context, { role: "member" });

  expect(isEphemeral(empty.calls.replies[0])).toBe(true);
  expect(findButton(empty.calls.replies[0], messages.controls.depositAll)?.disabled).toBe(true);
  expect(findButton(empty.calls.replies[0], messages.controls.withdrawAll)?.disabled).toBe(true);
  expect(findButton(empty.calls.replies[0], messages.controls.custom)?.disabled).toBe(false);

  await economyService.daily(GUILD, ME, "d");
  const funded = commandInteraction({});
  await balanceCommand.execute(funded.fake, context, { role: "member" });

  expect(findButton(funded.calls.replies[0], messages.controls.depositAll)?.disabled).toBe(false);
});

test("le solde d'un autre membre est public et sans bouton", async () => {
  const { context } = createContext();
  const command = commandInteraction({ users: { member: user(OTHER, "Autre") } });
  await balanceCommand.execute(command.fake, context, { role: "member" });

  expect(isEphemeral(command.calls.replies[0])).toBe(false);
  expect(buttonsOf(command.calls.replies[0])).toHaveLength(0);
});

test("« Tout déposer » puis « Tout retirer » mettent à jour le solde sur place", async () => {
  const { context, economyService } = createContext();
  await economyService.daily(GUILD, ME, "d"); // 200 en portefeuille

  const deposit = buttonInteraction({ id: "click-1" });
  await press(balanceComponents, deposit.fake, context, `ba:deposit-all:${ME}`);

  expect((await economyService.getAccount(GUILD, ME)).bank).toBe(200);
  expect(textOf(deposit.calls.updates[0])).toContain("Dernière opération");
  expect(findButton(deposit.calls.updates[0], messages.controls.depositAll)?.disabled).toBe(true);

  const withdraw = buttonInteraction({ id: "click-2" });
  await press(balanceComponents, withdraw.fake, context, `ba:withdraw-all:${ME}`);

  expect(await economyService.getAccount(GUILD, ME)).toMatchObject({ wallet: 200, bank: 0 });
});

test("un refus économique est privé et ne modifie pas le message", async () => {
  const { context } = createContext();
  const click = buttonInteraction({});

  await press(balanceComponents, click.fake, context, `ba:deposit-all:${ME}`);

  expect(click.calls.updates).toHaveLength(0);
  expect(isEphemeral(click.calls.replies[0])).toBe(true);
  expect(textOf(click.calls.replies[0])).toContain(messages.economy.errors.insufficientTitle);
});

test("« Montant précis… » ouvre une modale avec un menu et un champ de saisie", async () => {
  const { context } = createContext();
  const click = buttonInteraction({});

  await press(balanceComponents, click.fake, context, `ba:modal:${ME}`);

  expect(click.calls.modals).toHaveLength(1);
  const json = (click.calls.modals[0] as { toJSON(): { custom_id: string; title: string; components: { type: number }[] } }).toJSON();

  expect(json.custom_id).toBe(`ba:amount:${ME}`);
  expect(json.title).toBe(messages.balanceActions.modalTitle);
  expect(json.components).toHaveLength(2);
  expect(json.components.every((component) => component.type === 18)).toBe(true); // Label
});

test("la modale dépose ou retire le montant saisi, et rejette une saisie invalide", async () => {
  const { context, economyService } = createContext();
  await economyService.daily(GUILD, ME, "d"); // 200

  const deposit = modalInteraction({ operation: "deposit", amount: "150", id: "m1" });
  await press(balanceComponents, deposit.fake, context, `ba:amount:${ME}`);
  expect(await economyService.getAccount(GUILD, ME)).toMatchObject({ wallet: 50, bank: 150 });
  expect(textOf(deposit.calls.updates[0])).toContain("déposés");

  const withdraw = modalInteraction({ operation: "withdraw", amount: "tout", id: "m2" });
  await press(balanceComponents, withdraw.fake, context, `ba:amount:${ME}`);
  expect(await economyService.getAccount(GUILD, ME)).toMatchObject({ wallet: 200, bank: 0 });

  const invalid = modalInteraction({ operation: "deposit", amount: "abc", id: "m3" });
  await press(balanceComponents, invalid.fake, context, `ba:amount:${ME}`);
  expect(textOf(invalid.calls.replies[0])).toContain(messages.economy.errors.invalidAmountTitle);

  const unknown = modalInteraction({ operation: "hack", amount: "1", id: "m4" });
  await press(balanceComponents, unknown.fake, context, `ba:amount:${ME}`);
  expect(textOf(unknown.calls.replies[0])).toContain(messages.balanceActions.invalidOperationTitle);
});

test("parseAmount accepte « tout » et les entiers positifs seulement", () => {
  expect(parseAmount(" Tout ")).toBe("all");
  expect(parseAmount("all")).toBe("all");
  expect(parseAmount("250")).toBe(250);
  for (const bad of ["", "0", "-5", "1.5", "1e3", "abc", "12 3", "9".repeat(16)]) {
    expect(parseAmount(bad)).toBeNull();
  }
});

test("buildBalancePanel : le solde d'un tiers n'a jamais de bouton", () => {
  const panel = buildBalancePanel({
    user: user(OTHER, "Autre"),
    account: { ...emptyAccount(GUILD, OTHER), wallet: 5 },
  });

  expect(buttonsOf(panel)).toHaveLength(0);
  expect(textOf(panel)).toContain("PORTEFEUILLE");
});

// ------------------------------------------------------------ /me forget

test("/me forget affiche une confirmation privée avec deux boutons et n'efface rien", async () => {
  const { context } = createContext();
  const command = commandInteraction({});
  await forgetMeCommand.execute(command.fake, context, { role: "member" });
  const sent = command.calls.replies[0];

  expect(isEphemeral(sent)).toBe(true);
  expect(findButton(sent, messages.controls.confirmForget)?.style).toBe(4); // Danger
  expect(findButton(sent, messages.controls.cancel)?.custom_id).toBe(`fg:cancel:${ME}`);
  expect((await context.activityService.totalsForMember(GUILD, ME)).messages).toBe(1);
});

test("« Annuler » ne supprime rien ; « Effacer » supprime les données de suivi, pas l'économie", async () => {
  const { context, economyService, phaethonTracker, phaethonService } = createContext();
  await economyService.daily(GUILD, ME, "d");
  phaethonTracker.recordInteraction(GUILD, ME, OTHER, new Date(), { replies: 1 });
  phaethonTracker.recordInteraction(GUILD, OTHER, ME, new Date(), { replies: 1 });
  phaethonTracker.recordGameSeconds(GUILD, ME, "Celeste", "playing", 60, new Date());
  await phaethonService.flush();

  const cancel = buttonInteraction({});
  await press(forgetComponents, cancel.fake, context, `fg:cancel:${ME}`);
  expect(textOf(cancel.calls.updates[0])).toContain(messages.forgetDialog.cancelledTitle);
  expect((await context.activityService.totalsForMember(GUILD, ME)).messages).toBe(1);

  const confirm = buttonInteraction({});
  await press(forgetComponents, confirm.fake, context, `fg:confirm:${ME}`);

  expect(textOf(confirm.calls.updates[0])).toContain(messages.tracking.forget.doneTitle);
  expect(buttonsOf(confirm.calls.updates[0])).toHaveLength(0);
  expect((await context.activityService.totalsForMember(GUILD, ME)).messages).toBe(0);
  expect(await context.memberService.find(GUILD, ME)).toBeNull();
  expect((await context.activityService.totalsForMember(GUILD, OTHER)).messages).toBe(2);
  expect((await economyService.getAccount(GUILD, ME)).wallet).toBeGreaterThan(0);

  // Phaéthon aussi : relations (dans les deux sens), jeux, rien ne reste du membre.
  const dossier = await phaethonService.dossier(GUILD, ME);
  expect(dossier.contacts).toEqual([]);
  expect(dossier.games).toEqual([]);
  expect((await phaethonService.dossier(GUILD, OTHER)).contacts).toEqual([]);
});

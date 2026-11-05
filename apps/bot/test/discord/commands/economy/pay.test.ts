import { expect, test } from "bun:test";

import { payCommand } from "@/discord/commands/economy/pay.ts";
import { findCommand } from "@/discord/commands/index.ts";
import { messages } from "@/discord/messages.ts";
import { defaultSettings } from "@/domain/guilds/guild-types.ts";
import { GUILD, ME, OTHER, commandInteraction, createContext, isEphemeral, user } from "../../../support/fakes.ts";
import { textOf } from "../../../support/panel-text.ts";

test("/economy pay est enregistrée avec le rôle voulu", () => {
  expect(findCommand("economy", "pay")).toBe(payCommand);
  expect(payCommand.requiredRole).toBe("member");
});

async function funded(amount: number) {
  const setup = createContext();
  await setup.economyService.grantStartingBalance(GUILD, ME, amount);

  return setup;
}

test("un paiement débite l'expéditeur, crédite le destinataire net de la taxe du serveur et répond publiquement", async () => {
  const { context, economyService, guildStore } = await funded(1000);
  guildStore.settings.set(GUILD, { ...defaultSettings(GUILD), transferTaxPercent: 10, currencyName: "Gemmes" });
  const command = commandInteraction({ integers: { amount: 200 }, users: { member: user(OTHER, "Autre") } });

  await payCommand.execute(command.fake, context, { role: "member" });

  expect((await economyService.getAccount(GUILD, ME)).wallet).toBe(800);
  expect((await economyService.getAccount(GUILD, OTHER)).wallet).toBe(180);
  expect(command.replies).toHaveLength(1);
  expect(isEphemeral(command.replies[0])).toBe(false);
  const text = textOf(command.replies[0]);
  expect(text).toContain(`<@${OTHER}>`);
  expect(text).toContain("180 Gemmes");
  expect(text).toContain("20 Gemmes");
});

test("sans taxe, le destinataire reçoit tout", async () => {
  const { context, economyService } = await funded(500);
  const command = commandInteraction({ integers: { amount: 500 }, users: { member: user(OTHER, "Autre") } });

  await payCommand.execute(command.fake, context, { role: "member" });

  expect((await economyService.getAccount(GUILD, ME)).wallet).toBe(0);
  expect((await economyService.getAccount(GUILD, OTHER)).wallet).toBe(500);
});

test("refus privés et sans écriture : fonds insuffisants, soi-même, un bot", async () => {
  const { context, economyService } = await funded(100);

  for (const [member, amount, expected] of [
    [user(OTHER, "Autre"), 101, messages.economy.errors.insufficientTitle],
    [user(ME, "Moi"), 10, messages.economy.errors.selfTransferTitle],
    [{ ...user("999", "Robot"), bot: true }, 10, messages.economy.pay.botTitle],
  ] as const) {
    const command = commandInteraction({ integers: { amount }, users: { member } });
    await payCommand.execute(command.fake, context, { role: "member" });

    expect(textOf(command.replies[0])).toContain(expected);
    expect(isEphemeral(command.replies[0])).toBe(true);
  }

  expect((await economyService.getAccount(GUILD, ME)).wallet).toBe(100);
  expect((await economyService.getAccount(GUILD, OTHER)).wallet).toBe(0);
});

test("un réglage de taxe changé entre deux paiements s'applique au suivant, dès que le cache est relu", async () => {
  const { context, guildStore } = await funded(1000);
  const first = commandInteraction({ id: "p1", integers: { amount: 100 }, users: { member: user(OTHER, "Autre") } });
  await payCommand.execute(first.fake, context, { role: "member" });
  expect(textOf(first.replies[0])).not.toContain("taxe");

  guildStore.settings.set(GUILD, { ...defaultSettings(GUILD), transferTaxPercent: 25 });
  // Le cache vient d'être rempli : le réglage change et s'applique une fois le délai écoulé.
  await new Promise((resolve) => setTimeout(resolve, 0));
  context.guildService["cache"].clear();

  const second = commandInteraction({ id: "p2", integers: { amount: 100 }, users: { member: user(OTHER, "Autre") } });
  await payCommand.execute(second.fake, context, { role: "member" });

  expect(textOf(second.replies[0])).toContain("taxe");
  expect((await context.economyService.getAccount(GUILD, OTHER)).wallet).toBe(100 + 75);
});

import { expect, test } from "bun:test";

import { treasuryCommand } from "@/discord/commands/general/treasury.ts";
import { findCommand } from "@/discord/commands/index.ts";
import { messages } from "@/discord/messages.ts";
import { defaultSettings } from "@/domain/guilds/guild-types.ts";
import { GUILD, ME, OTHER, commandInteraction, createContext, isEphemeral } from "../../../support/fakes.ts";
import { textOf } from "../../../support/panel-text.ts";

test("/server treasury est enregistrée pour tous les membres", () => {
  expect(findCommand("server", "treasury")).toBe(treasuryCommand);
  expect(treasuryCommand.requiredRole).toBe("member");
});

test("/server treasury montre la taxe encaissée, dans la monnaie du serveur, et répond publiquement", async () => {
  const { context, economyService, guildStore } = createContext();
  guildStore.settings.set(GUILD, { ...defaultSettings(GUILD), transferTaxPercent: 10, bankInterestPermille: 5, currencyName: "Gemmes" });
  await economyService.grantStartingBalance(GUILD, ME, 1000);
  await economyService.pay(GUILD, ME, OTHER, 500, 10, "pay-1");
  const command = commandInteraction({});

  await treasuryCommand.execute(command.fake, context, { role: "member" });

  expect(command.replies).toHaveLength(1);
  expect(isEphemeral(command.replies[0])).toBe(false);
  const text = textOf(command.replies[0]);
  expect(text).toContain(messages.general.treasury.title);
  expect(text).toContain("50 Gemmes");
  expect(text).toContain("10 %");
  expect(text).toContain("0,5 % par jour");
});

test("/server treasury d'un serveur sans rien affiche zéro", async () => {
  const { context } = createContext();
  const command = commandInteraction({});

  await treasuryCommand.execute(command.fake, context, { role: "member" });

  expect(textOf(command.replies[0])).toContain("0");
  expect(textOf(command.replies[0])).toContain(messages.general.treasury.taxLine(0));
  expect(textOf(command.replies[0])).toContain(messages.general.treasury.interestLine(0));
});

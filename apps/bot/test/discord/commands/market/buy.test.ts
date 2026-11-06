import { expect, test } from "bun:test";

import { buyCommand } from "@/discord/commands/market/buy.ts";
import { findCommand } from "@/discord/commands/index.ts";
import { formatCoins } from "@/discord/formatting.ts";
import { messages } from "@/discord/messages.ts";
import { GUILD, ME, commandInteraction, createContext, isEphemeral } from "../../../support/fakes.ts";
import { textOf } from "../../../support/panel-text.ts";

test("/market buy est enregistrée avec le rôle voulu", () => {
  expect(findCommand("market", "buy")).toBe(buyCommand);
  expect(buyCommand.requiredRole).toBe("member");
});

test("/market buy achète au cours, frais compris, et répond publiquement", async () => {
  const { context, economyService } = createContext();
  await economyService.grantStartingBalance(GUILD, ME, 5_000);
  const command = commandInteraction({ integers: { count: 10 } });

  await buyCommand.execute(command.fake, context, { role: "member" });

  expect(command.replies).toHaveLength(1);
  expect(isEphemeral(command.replies[0])).toBe(false);
  expect(textOf(command.replies[0])).toContain(messages.market.buy.title);
  expect(textOf(command.replies[0])).toContain(formatCoins(1010));
  expect(await economyService.getAccount(GUILD, ME)).toMatchObject({ wallet: 3990, shares: 10 });
});

test("/market buy sans les fonds : refus privé, rien ne change", async () => {
  const { context, economyService } = createContext();
  const command = commandInteraction({ integers: { count: 10 } });

  await buyCommand.execute(command.fake, context, { role: "member" });

  expect(isEphemeral(command.replies[0])).toBe(true);
  expect(textOf(command.replies[0])).toContain(messages.economy.errors.insufficientTitle);
  expect((await economyService.getAccount(GUILD, ME)).shares).toBe(0);
});

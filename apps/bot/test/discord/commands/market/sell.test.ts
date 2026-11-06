import { expect, test } from "bun:test";

import { sellCommand } from "@/discord/commands/market/sell.ts";
import { findCommand } from "@/discord/commands/index.ts";
import { messages } from "@/discord/messages.ts";
import { GUILD, ME, commandInteraction, createContext, isEphemeral } from "../../../support/fakes.ts";
import { textOf } from "../../../support/panel-text.ts";

test("/market sell est enregistrée avec le rôle voulu", () => {
  expect(findCommand("market", "sell")).toBe(sellCommand);
  expect(sellCommand.requiredRole).toBe("member");
});

test("/market sell revend au cours, moins les frais", async () => {
  const { context, economyService } = createContext();
  await economyService.grantStartingBalance(GUILD, ME, 5_000);
  await economyService.buyShares(GUILD, ME, 10, "buy-1");
  const command = commandInteraction({ integers: { count: 4 } });

  await sellCommand.execute(command.fake, context, { role: "member" });

  expect(command.replies).toHaveLength(1);
  expect(textOf(command.replies[0])).toContain(messages.market.sell.title);
  expect(await economyService.getAccount(GUILD, ME)).toMatchObject({ wallet: 3990 + 396, shares: 6 });
});

test("/market sell sans actions : refus privé", async () => {
  const { context } = createContext();
  const command = commandInteraction({ integers: { count: 1 } });

  await sellCommand.execute(command.fake, context, { role: "member" });

  expect(isEphemeral(command.replies[0])).toBe(true);
  expect(textOf(command.replies[0])).toContain(messages.economy.errors.sharesTitle);
});

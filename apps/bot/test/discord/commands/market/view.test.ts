import { expect, test } from "bun:test";

import { viewCommand } from "@/discord/commands/market/view.ts";
import { findCommand } from "@/discord/commands/index.ts";
import { messages } from "@/discord/messages.ts";
import { commandInteraction, createContext, isEphemeral } from "../../../support/fakes.ts";
import { textOf } from "../../../support/panel-text.ts";

test("/market view est enregistrée avec le rôle voulu", () => {
  expect(findCommand("market", "view")).toBe(viewCommand);
  expect(viewCommand.requiredRole).toBe("member");
});

test("/market view répond d'un seul panneau", async () => {
  const { context } = createContext();
  const command = commandInteraction({});

  await viewCommand.execute(command.fake, context, { role: "member" });

  expect(command.replies).toHaveLength(1);
  expect(textOf(command.replies[0])).toContain(messages.market.view.title);
  expect(isEphemeral(command.replies[0])).toBe(true);
});

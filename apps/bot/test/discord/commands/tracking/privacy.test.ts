import { expect, test } from "bun:test";

import { dailyCommand } from "@/discord/commands/economy/daily.ts";
import { leaderboardCommand } from "@/discord/commands/tracking/leaderboard.ts";
import { statsCommand } from "@/discord/commands/tracking/stats.ts";
import { messages } from "@/discord/messages.ts";
import {
  ME,
  OTHER,
  commandInteraction,
  createContext,
  isEphemeral,
  user,
} from "../../../support/fakes.ts";
import { textOf } from "../../../support/panel-text.ts";

const other = user(OTHER, "Autre");

test("un membre ne peut pas consulter un classement d'activité", async () => {
  const { context } = createContext();
  const command = commandInteraction({ strings: { category: "messages" } });

  await leaderboardCommand.execute(command.fake, context, { role: "member" });

  expect(isEphemeral(command.replies[0])).toBe(true);
  expect(textOf(command.replies[0])).toContain(messages.errors.adminOnly);
});

test("un administrateur voit le classement d'activité en privé, un membre voit celui de richesse en public", async () => {
  const { context } = createContext();
  const admin = commandInteraction({ strings: { category: "messages" } });
  await leaderboardCommand.execute(admin.fake, context, { role: "admin" });

  const text = textOf(admin.replies[0]);
  expect(isEphemeral(admin.replies[0])).toBe(true);
  expect(text).toContain(`<@${OTHER}> — **2**`);
  expect(text.indexOf(OTHER)).toBeLessThan(text.indexOf(ME));
  expect(text).toContain("🥇");

  const economy = commandInteraction({ strings: { category: "economy" } });
  await leaderboardCommand.execute(economy.fake, context, { role: "member" });

  expect(textOf(economy.replies[0])).toContain(messages.tracking.leaderboard.empty);
  expect(isEphemeral(economy.replies[0])).toBe(false);
});

test("/stats : chacun voit les siennes, seul un administrateur voit celles d'un autre", async () => {
  const { context } = createContext();

  const mine = commandInteraction({});
  await statsCommand.execute(mine.fake, context, { role: "member" });
  expect(textOf(mine.replies[0])).toContain("**1** messages");
  expect(isEphemeral(mine.replies[0])).toBe(true);

  const denied = commandInteraction({ users: { member: other } });
  await statsCommand.execute(denied.fake, context, { role: "member" });
  expect(textOf(denied.replies[0])).toContain(messages.errors.adminOnly);

  const allowed = commandInteraction({ users: { member: other } });
  await statsCommand.execute(allowed.fake, context, { role: "admin" });
  expect(textOf(allowed.replies[0])).toContain("**2** messages");
});

test("/daily répond avec la récompense et refuse un second appel trop tôt", async () => {
  const { context } = createContext();

  const first = commandInteraction({ id: "d1" });
  await dailyCommand.execute(first.fake, context, { role: "member" });
  expect(textOf(first.replies[0])).toContain("1 jour");

  const second = commandInteraction({ id: "d2" });
  await dailyCommand.execute(second.fake, context, { role: "member" });
  expect(isEphemeral(second.replies[0])).toBe(true);
  expect(textOf(second.replies[0])).toContain(messages.economy.errors.cooldownTitle);
  expect(textOf(second.replies[0])).toContain("Revenez <t:");
});

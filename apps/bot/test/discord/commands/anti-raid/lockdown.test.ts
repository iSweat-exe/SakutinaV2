import { expect, test } from "bun:test";

import { lockdownCommand } from "@/discord/commands/anti-raid/lockdown.ts";
import { unlockCommand } from "@/discord/commands/anti-raid/unlock.ts";
import { findCommand } from "@/discord/commands/index.ts";
import { messages } from "@/discord/messages.ts";
import type { HandlerContext } from "@/discord/handler-context.ts";
import { commandInteraction, ME } from "../../../support/fakes.ts";
import { textOf } from "../../../support/panel-text.ts";
import { channel, fakeGuild, setup } from "../../anti-raid/support.ts";

/** Une commande différée : la réponse arrive par `editReply`. */
function deferredCommand(guild: unknown) {
  const command = commandInteraction({ guild });
  const fake = command.fake as unknown as { deferred: boolean; deferReply: (options: unknown) => Promise<void> };
  const deferrals: unknown[] = [];
  fake.deferReply = async (options) => {
    deferrals.push(options);
    fake.deferred = true;
  };
  return { ...command, deferrals };
}

test("/server lockdown et /server unlock sont enregistrées, réservées aux administrateurs", () => {
  expect(findCommand("server", "lockdown")).toBe(lockdownCommand);
  expect(findCommand("server", "unlock")).toBe(unlockCommand);
  expect(lockdownCommand.requiredRole).toBe("admin");
  expect(unlockCommand.requiredRole).toBe("admin");
});

test("/server lockdown verrouille (réponse privée différée), puis refuse un second verrouillage", async () => {
  const guild = fakeGuild([channel("general", null), channel("memes", null)]);
  const { guard, store } = setup(guild);
  const context = { raidGuard: guard } as unknown as HandlerContext;

  const first = deferredCommand(guild);
  await lockdownCommand.execute(first.fake, context, { role: "admin" });

  expect(first.deferrals).toEqual([{ flags: 64 }]);
  expect(textOf(first.edits[0])).toContain(messages.antiRaid.lockdown.title);
  expect(textOf(first.edits[0])).toContain(messages.antiRaid.lockedChannels(2));
  expect((await store.active())[0]?.startedBy).toBe(ME);

  const second = deferredCommand(guild);
  await lockdownCommand.execute(second.fake, context, { role: "admin" });
  expect(textOf(second.edits[0])).toContain(messages.antiRaid.lockdown.already);
});

test("/server unlock lève le raid et rétablit les salons ; sans raid, le dit", async () => {
  const guild = fakeGuild([channel("general", null)]);
  const { guard } = setup(guild);
  const context = { raidGuard: guard } as unknown as HandlerContext;

  const none = deferredCommand(guild);
  await unlockCommand.execute(none.fake, context, { role: "admin" });
  expect(textOf(none.edits[0])).toContain(messages.antiRaid.unlock.none);

  await guard.lockdown(guild as never, "admin");
  const done = deferredCommand(guild);
  await unlockCommand.execute(done.fake, context, { role: "admin" });
  expect(textOf(done.edits[0])).toContain(messages.antiRaid.unlock.title);
  expect(textOf(done.edits[0])).toContain(messages.antiRaid.restoredChannels(1));
});

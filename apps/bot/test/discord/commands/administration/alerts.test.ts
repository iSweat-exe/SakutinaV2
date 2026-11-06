import { expect, test } from "bun:test";

import { alertsCommand } from "@/discord/commands/administration/alerts.ts";
import { findCommand } from "@/discord/commands/index.ts";
import { messages } from "@/discord/messages.ts";
import { commandInteraction, createContext, GUILD } from "../../../support/fakes.ts";
import { textOf } from "../../../support/panel-text.ts";

const text = messages.admin.alerts;

/** Une commande avec un salon choisi ; `writable` : le bot peut y écrire. */
function alertsInteraction(options: { channelId?: string; writable?: boolean; remove?: boolean }) {
  const posted: unknown[] = [];
  const channel = options.channelId
    ? {
        id: options.channelId,
        isSendable: () => true,
        permissionsFor: () => ({ has: () => options.writable ?? true }),
        send: async (payload: unknown) => {
          posted.push(payload);
        },
      }
    : null;
  const guild = { channels: { cache: new Map(channel ? [[channel.id, channel]] : []) }, members: { me: { id: "bot" } } };
  const command = commandInteraction({ guild, booleans: options.remove ? { remove: true } : {} });
  (command.fake.options as unknown as { getChannel: () => unknown }).getChannel = () => channel;

  return { ...command, posted };
}

test("/server alerts est enregistrée, réservée aux administrateurs", () => {
  expect(findCommand("server", "alerts")).toBe(alertsCommand);
  expect(alertsCommand.requiredRole).toBe("admin");
});

test("sans option, dit qu'il n'y a pas de salon ; un salon choisi est enregistré, annoncé et journalisé", async () => {
  const { context, guildStore, auditLog } = createContext();

  const none = alertsInteraction({});
  await alertsCommand.execute(none.fake, context, { role: "admin" });
  expect(textOf(none.replies[0])).toContain(text.none);

  const set = alertsInteraction({ channelId: "555" });
  await alertsCommand.execute(set.fake, context, { role: "admin" });
  expect(textOf(set.replies[0])).toContain(text.set("<#555>"));
  expect(set.posted).toHaveLength(1);
  expect((await guildStore.getSettings(GUILD))?.alertChannelId).toBe("555");
  expect((await auditLog.listForGuild(GUILD, 10)).map((e) => [e.action, e.metadata.channel])).toEqual([["settings.alerts", "555"]]);

  const shown = alertsInteraction({});
  await alertsCommand.execute(shown.fake, context, { role: "admin" });
  expect(textOf(shown.replies[0])).toContain(text.current("<#555>"));
});

test("refuse un salon où le bot ne peut pas écrire ; « remove » retire le salon", async () => {
  const { context, guildStore } = createContext();

  const refused = alertsInteraction({ channelId: "777", writable: false });
  await alertsCommand.execute(refused.fake, context, { role: "admin" });
  expect(textOf(refused.replies[0])).toContain(text.notWritable("<#777>"));
  expect((await guildStore.getSettings(GUILD))?.alertChannelId ?? null).toBeNull();

  await alertsCommand.execute(alertsInteraction({ channelId: "555" }).fake, context, { role: "admin" });
  const removed = alertsInteraction({ remove: true });
  await alertsCommand.execute(removed.fake, context, { role: "admin" });
  expect(textOf(removed.replies[0])).toContain(text.removed);
  expect((await guildStore.getSettings(GUILD))?.alertChannelId).toBeNull();
});

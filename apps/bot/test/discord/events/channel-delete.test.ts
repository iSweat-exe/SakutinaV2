import { expect, test } from "bun:test";

import { events } from "@/discord/events/index.ts";
import { channelDelete } from "@/discord/events/channel-delete.ts";

test("channelDelete est enregistré dans la liste des événements", () => {
  expect(events).toContain(channelDelete);
});

test("channelDelete recalcule la liste des salons du serveur, jamais pour un message privé", () => {
  const scheduled: string[] = [];
  const context = { guildSync: { schedule: (guild: { id: string }) => scheduled.push(guild.id) } } as never;
  const guildChannel = { guild: { id: "g1" }, isDMBased: () => false } as never;
  const dm = { isDMBased: () => true } as never;
  const run = channelDelete.execute as (...args: unknown[]) => void;

  run(context, guildChannel);
  run(context, dm);
  expect(scheduled).toEqual(["g1"]);
});

import { expect, test } from "bun:test";

import { MemoryGuildStore } from "@/database/in-memory/memory-guild-store.ts";
import { createAlertPoster } from "@/discord/alerts/alert-poster.ts";
import { GuildService } from "@/domain/guilds/guild-service.ts";
import type { Alert } from "@/domain/phaethon/phaethon-types.ts";

const alert = { kind: "suspicious-account", memberId: "123456", measured: 1, threshold: 7 } as unknown as Alert;

async function setup(phaethonOn: boolean) {
  const guildService = new GuildService(new MemoryGuildStore());
  await guildService.setAlertChannel("g", "c1");
  const sent: unknown[] = [];
  const client = {
    channels: {
      fetch: async () => ({ isDMBased: () => false, guildId: "g", isSendable: () => true, send: async (payload: unknown) => sent.push(payload) }),
    },
  } as never;

  return { sent, poster: createAlertPoster(client, guildService, async () => phaethonOn) };
}

test("les alertes de Phaéthon partent dans le salon d'alertes quand le module est actif", async () => {
  const { sent, poster } = await setup(true);
  await poster("g", [alert]);
  expect(sent).toHaveLength(1);
});

test("module Phaethon coupé : aucune alerte publiée", async () => {
  const { sent, poster } = await setup(false);
  await poster("g", [alert]);
  expect(sent).toEqual([]);
});

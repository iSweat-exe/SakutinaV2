import { expect, test } from "bun:test";

import { createInterestRunner } from "@/app/interest-runner.ts";
import { defaultSettings } from "@/domain/guilds/guild-types.ts";

const settingsOf = (permilles: Record<string, number>) => ({
  settings: async (guildId: string) => ({ ...defaultSettings(guildId), bankInterestPermille: permilles[guildId] ?? 0 }),
});

test("seuls les serveurs qui ont activé les intérêts sont réglés, au taux de leur réglage", async () => {
  const calls: Array<[string, number]> = [];
  const run = createInterestRunner({
    guildIds: () => ["a", "b", "c"],
    guildService: settingsOf({ a: 5, c: 20 }),
    economyService: { accrueInterest: async (guildId, permille) => (calls.push([guildId, permille]), { members: 0, wanted: 0, paid: 0 }) },
  });

  await run();

  expect(calls).toEqual([["a", 5], ["c", 20]]);
});

test("un serveur en échec n'empêche pas les suivants", async () => {
  const calls: string[] = [];
  const run = createInterestRunner({
    guildIds: () => ["a", "b"],
    guildService: settingsOf({ a: 5, b: 5 }),
    economyService: {
      accrueInterest: async (guildId) => {
        calls.push(guildId);

        if (guildId === "a") {
          throw new Error("db down");
        }

        return null;
      },
    },
  });

  await run();

  expect(calls).toEqual(["a", "b"]);
});

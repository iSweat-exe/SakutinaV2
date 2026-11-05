import { expect, test } from "bun:test";

import { guildBanAdd, timing } from "@/discord/events/guild-ban-add.ts";
import { guildBanRemove } from "@/discord/events/guild-ban-remove.ts";
import { events } from "@/discord/events/index.ts";
import { GUILD, createContext } from "../../support/fakes.ts";

test("les événements de bannissement sont enregistrés", () => {
  expect(events).toContain(guildBanAdd);
  expect(events).toContain(guildBanRemove);
});

const ban = (reason: string | null = null) => ({ guild: { id: GUILD }, user: { id: "cible" }, reason }) as never;

test("un bannissement fait dans Discord est enregistré (auteur inconnu), une seule fois, et levé par l'événement inverse", async () => {
  timing.settleMs = 0;
  const { context, sanctionStore } = createContext();

  await guildBanAdd.execute(context, ban("raid"));
  await guildBanAdd.execute(context, ban("raid"));

  expect(sanctionStore.sanctions).toHaveLength(1);
  expect(sanctionStore.sanctions[0]).toMatchObject({ kind: "ban", moderatorId: null, memberId: "cible", reason: "raid" });

  await guildBanRemove.execute(context, ban());
  expect(sanctionStore.sanctions[0]?.revokedAt).not.toBeNull();
});

test("un bannissement déjà enregistré par le bot n'est pas doublé", async () => {
  timing.settleMs = 0;
  const { context, sanctionStore } = createContext();
  await context.sanctionService.recordBan(GUILD, "cible", "admin", "raid");

  await guildBanAdd.execute(context, ban("raid"));

  expect(sanctionStore.sanctions).toHaveLength(1);
  expect(sanctionStore.sanctions[0]?.moderatorId).toBe("admin");
});

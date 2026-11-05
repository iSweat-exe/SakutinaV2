import { expect, test } from "bun:test";

import { events } from "@/discord/events/index.ts";
import { guildUpdate } from "@/discord/events/guild-update.ts";

test("guildUpdate est enregistré dans la liste des événements", () => {
  expect(events).toContain(guildUpdate);
});

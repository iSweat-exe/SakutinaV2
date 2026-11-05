import { expect, test } from "bun:test";

import { events } from "@/discord/events/index.ts";
import { guildDelete } from "@/discord/events/guild-delete.ts";

test("guildDelete est enregistré dans la liste des événements", () => {
  expect(events).toContain(guildDelete);
});

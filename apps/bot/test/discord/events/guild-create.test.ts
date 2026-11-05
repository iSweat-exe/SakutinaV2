import { expect, test } from "bun:test";

import { events } from "@/discord/events/index.ts";
import { guildCreate } from "@/discord/events/guild-create.ts";

test("guildCreate est enregistré dans la liste des événements", () => {
  expect(events).toContain(guildCreate);
});

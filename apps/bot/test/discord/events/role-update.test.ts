import { expect, test } from "bun:test";

import { events } from "@/discord/events/index.ts";
import { roleUpdate } from "@/discord/events/role-update.ts";

test("roleUpdate est enregistré dans la liste des événements", () => {
  expect(events).toContain(roleUpdate);
});

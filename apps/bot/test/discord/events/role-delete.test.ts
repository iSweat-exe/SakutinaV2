import { expect, test } from "bun:test";

import { events } from "@/discord/events/index.ts";
import { roleDelete } from "@/discord/events/role-delete.ts";

test("roleDelete est enregistré dans la liste des événements", () => {
  expect(events).toContain(roleDelete);
});

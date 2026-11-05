import { expect, test } from "bun:test";

import { events } from "@/discord/events/index.ts";
import { roleCreate } from "@/discord/events/role-create.ts";

test("roleCreate est enregistré dans la liste des événements", () => {
  expect(events).toContain(roleCreate);
});

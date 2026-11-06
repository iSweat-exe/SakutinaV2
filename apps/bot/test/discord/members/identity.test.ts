import { expect, test } from "bun:test";

import { identityOf } from "@/discord/members/identity.ts";
import { MAX_ROLE_NAMES } from "@/domain/members/member-profile.ts";

const GUILD = "g1";
const role = (id: string, name: string, position: number) => [id, { id, name, position }] as const;
const memberWith = (roles: ReadonlyArray<readonly [string, { id: string; name: string; position: number }]>) =>
  ({
    displayName: "Aiko",
    user: { avatar: "hash", username: "aiko" },
    roles: { cache: new Map(roles) },
    guild: { id: GUILD },
  }) as never;

test("identityOf garde le nom d'utilisateur et les rôles, du plus haut au plus bas, sans @everyone", () => {
  const identity = identityOf(memberWith([role(GUILD, "@everyone", 0), role("r1", "Regular", 2), role("r2", "Moderator", 7)]));

  expect(identity).toEqual({ displayName: "Aiko", avatar: "hash", username: "aiko", roleNames: ["Moderator", "Regular"] });
});

test("identityOf limite le nombre de rôles gardés", () => {
  const many = Array.from({ length: MAX_ROLE_NAMES + 5 }, (_, i) => role(`r${i}`, `Rôle ${i}`, i + 1));

  expect(identityOf(memberWith(many)).roleNames).toHaveLength(MAX_ROLE_NAMES);
  expect(identityOf(memberWith(many)).roleNames[0]).toBe(`Rôle ${MAX_ROLE_NAMES + 4}`);
});

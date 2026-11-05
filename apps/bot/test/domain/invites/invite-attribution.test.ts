import { expect, test } from "bun:test";

import {
  attributeInvite,
  type InviteState,
} from "@/domain/invites/invite-attribution.ts";

const inv = (uses: number, inviterId: string | null = "i"): InviteState => ({
  uses,
  inviterId,
});

test("attribue l'unique invitation dont l'usage a augmenté", () => {
  const result = attributeInvite(
    new Map([
      ["a", 1],
      ["b", 3],
    ]),
    new Map([
      ["a", inv(1)],
      ["b", inv(4, "bob")],
    ]),
  );

  expect(result).toEqual({ code: "b", inviterId: "bob" });
});

test("n'attribue pas quand plusieurs invitations ont augmenté", () => {
  const result = attributeInvite(
    new Map([
      ["a", 0],
      ["b", 0],
    ]),
    new Map([
      ["a", inv(1)],
      ["b", inv(1)],
    ]),
  );

  expect(result).toBeNull();
});

test("attribue une invitation à usage unique disparue", () => {
  const result = attributeInvite(
    new Map([
      ["once", 0],
      ["b", 2],
    ]),
    new Map([["b", inv(2)]]),
    new Map([
      ["once", inv(0, "alice")],
      ["b", inv(2)],
    ]),
  );

  expect(result).toEqual({ code: "once", inviterId: "alice" });
});

test("ne devine pas sans signal ou avec plusieurs disparues", () => {
  expect(
    attributeInvite(new Map([["a", 1]]), new Map([["a", inv(1)]])),
  ).toBeNull();
  expect(
    attributeInvite(
      new Map([
        ["a", 0],
        ["b", 0],
      ]),
      new Map(),
    ),
  ).toBeNull();
});

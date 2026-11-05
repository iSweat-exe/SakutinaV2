import { expect, test } from "bun:test";

import { encodeId, parseId } from "@/discord/components/custom-id.ts";

test("encode puis parse restitue l'espace de noms, l'action, le propriétaire et les arguments", () => {
  const raw = encodeId("lb", "days", "123456789", "messages", 7);

  expect(raw).toBe("lb:days:123456789:messages:7");
  expect(parseId(raw)).toEqual({
    namespace: "lb",
    action: "days",
    ownerId: "123456789",
    args: ["messages", "7"],
  });
});

test("un identifiant sans arguments est valide", () => {
  expect(parseId(encodeId("fg", "cancel", "1"))).toEqual({
    namespace: "fg",
    action: "cancel",
    ownerId: "1",
    args: [],
  });
});

test("parse rejette un identifiant qui n'est pas de ce bot", () => {
  expect(parseId("")).toBeNull();
  expect(parseId("seul")).toBeNull();
  expect(parseId("a:b")).toBeNull();
});

test("encode refuse les séparateurs dans une valeur et les identifiants trop longs", () => {
  expect(() => encodeId("a", "b", "1", "x:y")).toThrow("':'");
  expect(() => encodeId("a", "b", "1", "x".repeat(100))).toThrow("100");
  expect(encodeId("a", "b", "1", "x".repeat(90)).length).toBeLessThanOrEqual(100);
});

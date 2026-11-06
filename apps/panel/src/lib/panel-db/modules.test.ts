import { expect, test } from "bun:test";
import { isModuleId, parseModules } from "./modules-schema";

test("parseModules accepte la forme de la fonction SQL", () => {
  expect(parseModules({ antiraid: true, casino: false, phaethon: true, profiling: false, raid_active: true })).toEqual({
    antiraid: true,
    casino: false,
    phaethon: true,
    profiling: false,
    raidActive: true,
  });
});

test("parseModules refuse ce qui n'a pas la forme attendue ; seuls quatre modules se coupent", () => {
  expect(parseModules(null)).toBeNull();
  expect(parseModules({ antiraid: true, casino: true, phaethon: true, profiling: "yes", raid_active: false })).toBeNull();
  expect(parseModules({ antiraid: true, casino: true, phaethon: true, profiling: true })).toBeNull();
  expect(isModuleId("casino")).toBe(true);
  expect(isModuleId("moderation")).toBe(false);
});

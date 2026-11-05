import { expect, test } from "bun:test";
import { parseGuild, parseGuildList } from "./guilds-schema";

const row = { id: "123456", name: "Uwu", icon: "abc", banner: null, member_count: 80, role: "owner" };

test("parseGuild accepte la forme de la fonction SQL", () => {
  expect(parseGuild(row)).toEqual({ id: "123456", name: "Uwu", icon: "abc", banner: null, memberCount: 80, role: "owner" });
});

test("parseGuild accepte un serveur sans le bot (nom vide)", () => {
  expect(parseGuild({ ...row, name: null, icon: null, member_count: null, role: "admin" })).toEqual({
    id: "123456",
    name: null,
    icon: null,
    banner: null,
    memberCount: null,
    role: "admin",
  });
});

test("parseGuild refuse ce qui n'a pas la forme attendue", () => {
  expect(parseGuild(null)).toBeNull();
  expect(parseGuild({ ...row, id: "../evil" })).toBeNull();
  expect(parseGuild({ ...row, role: "member" })).toBeNull();
});

test("parseGuildList refuse toute la liste si une entrée est invalide", () => {
  expect(parseGuildList([row])).toHaveLength(1);
  expect(parseGuildList([])).toEqual([]);
  expect(parseGuildList([row, { id: 1 }])).toBeNull();
  expect(parseGuildList({})).toBeNull();
});

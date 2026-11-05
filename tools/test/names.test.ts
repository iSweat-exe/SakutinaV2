import { expect, test } from "bun:test";
import { camel, isDiscordName, kebab, snake } from "../lib/names.ts";

test("les trois casses acceptent n'importe quelle entrée", () => {
  for (const input of ["kick-user", "kick_user", "Kick User", "kickUser", "KickUser"]) {
    expect([camel(input), kebab(input), snake(input)]).toEqual(["kickUser", "kick-user", "kick_user"]);
  }
});

test("les événements discord.js gardent leurs frontières de mots", () => {
  expect(kebab("guildBanAdd")).toBe("guild-ban-add");
  expect(camel("GuildBanAdd")).toBe("guildBanAdd");
});

test("un nom de sous-commande Discord", () => {
  expect(isDiscordName("shop")).toBe(true);
  expect(isDiscordName("shop-items_2")).toBe(true);
  for (const bad of ["Shop", "a b", "", "x".repeat(33), "é"]) expect(isDiscordName(bad)).toBe(false);
});

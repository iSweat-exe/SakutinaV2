import { expect, test } from "bun:test";

import { readAppConfig } from "@sakutina/config";

const base = {
  DISCORD_TOKEN: "token",
  DISCORD_PRIMARY_GUILD_ID: "1317931106993180763",
};

test("accepte le port Render et le serveur historique", () => {
  const config = readAppConfig({ ...base, PORT: "3000", NODE_ENV: "test" });

  expect(config).toMatchObject({
    legacyGuildId: "1317931106993180763",
    port: 3000,
    environment: "test",
    databaseUrl: null,
    alertChannelId: null,
    trackPresence: false,
    adminRoleIds: [],
    moderatorRoleIds: [],
  });
});

test("exige DATABASE_URL en production", () => {
  expect(() => readAppConfig({ ...base, NODE_ENV: "production" })).toThrow(
    "DATABASE_URL",
  );
  expect(
    readAppConfig({
      ...base,
      NODE_ENV: "production",
      DATABASE_URL: "postgres://x",
    }).databaseUrl,
  ).toBe("postgres://x");
});

test("lit les rôles et rejette les identifiants invalides", () => {
  const config = readAppConfig({
    ...base,
    ADMIN_ROLE_IDS: "111111111111111111, 222222222222222222",
  });

  expect(config.adminRoleIds).toEqual([
    "111111111111111111",
    "222222222222222222",
  ]);
  expect(() => readAppConfig({ ...base, MODERATOR_ROLE_IDS: "abc" })).toThrow(
    "MODERATOR_ROLE_IDS",
  );
});

test("rejette un port invalide et un token manquant", () => {
  expect(() => readAppConfig({ ...base, PORT: "99999" })).toThrow("PORT");
  expect(() => readAppConfig({ DISCORD_PRIMARY_GUILD_ID: "1" })).toThrow(
    "DISCORD_TOKEN",
  );
});

test("le salon d'alertes doit être un identifiant Discord et la présence est désactivée par défaut", () => {
  expect(() => readAppConfig({ ...base, ALERT_CHANNEL_ID: "pas-un-id" })).toThrow("ALERT_CHANNEL_ID");

  const config = readAppConfig({ ...base, ALERT_CHANNEL_ID: "1317931106993180763", TRACK_PRESENCE: "true" });

  expect(config.alertChannelId).toBe("1317931106993180763");
  expect(config.trackPresence).toBe(true);
  expect(readAppConfig({ ...base, TRACK_PRESENCE: "no" }).trackPresence).toBe(false);
});

test("multi-serveur : le serveur historique est facultatif, mais doit être un identifiant Discord", () => {
  expect(readAppConfig({ DISCORD_TOKEN: "token" }).legacyGuildId).toBeNull();
  expect(() => readAppConfig({ DISCORD_TOKEN: "token", DISCORD_PRIMARY_GUILD_ID: "abc" })).toThrow(
    "DISCORD_PRIMARY_GUILD_ID",
  );
});

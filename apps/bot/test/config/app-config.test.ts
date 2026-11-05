import { expect, test } from "bun:test";

import { readAppConfig } from "@sakutina/config";

const base = {
  DISCORD_TOKEN: "token",
  DISCORD_PRIMARY_GUILD_ID: "1317931106993180763",
};

test("accepte le port Render et le serveur principal explicite", () => {
  const config = readAppConfig({ ...base, PORT: "3000", NODE_ENV: "test" });

  expect(config).toMatchObject({
    primaryGuildId: "1317931106993180763",
    port: 3000,
    environment: "test",
    databaseUrl: null,
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

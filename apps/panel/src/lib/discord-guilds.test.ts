import { describe, expect, test } from "bun:test";
import { botInviteUrl, decodeGuilds, encodeGuilds, guildBannerUrl, guildIconUrl, inviteUrl, memberAvatarUrl, parseDiscordGuilds } from "@/lib/discord-guilds";

describe("parseDiscordGuilds", () => {
  test("distingue les serveurs gérables (propriétaire, Administrateur, Gérer le serveur)", () => {
    const guilds = parseDiscordGuilds([
      { id: "111111", name: "Membre", owner: false, permissions: "0" },
      { id: "222222", name: "Proprio", owner: true, permissions: "0" },
      { id: "333333", name: "Admin", owner: false, permissions: "8" },
      { id: "444444", name: "Gestion", owner: false, permissions: String(0x20) },
    ]);

    expect(guilds.map((g) => [g.name, g.canManage])).toEqual([
      ["Admin", true],
      ["Gestion", true],
      ["Proprio", true],
      ["Membre", false],
    ]);
  });

  test("ignore les entrées invalides et les réponses inattendues", () => {
    expect(parseDiscordGuilds({ message: "401: Unauthorized" })).toEqual([]);
    expect(parseDiscordGuilds([null, { id: 5, name: "x" }, { id: "abc", name: "x" }, { id: "123456", permissions: "zzz", name: "Ok" }])).toEqual([
      { id: "123456", name: "Ok", icon: null, banner: null, canManage: false },
    ]);
  });
});

describe("cookie", () => {
  test("aller-retour", () => {
    const guilds = [{ id: "123456", name: "Café « Été »", icon: "a".repeat(32), banner: "c".repeat(32), canManage: true }];
    expect(decodeGuilds(encodeGuilds(guilds))).toEqual(guilds);
  });

  test("reste sous la limite des cookies et garde les serveurs gérables en premier", () => {
    const many = Array.from({ length: 200 }, (_, i) => ({ id: String(100000 + i), name: `Serveur numéro ${i} très long`, icon: "b".repeat(32), banner: null, canManage: i === 199 }));
    const encoded = encodeGuilds(many);

    expect(encodeURIComponent(encoded).length).toBeLessThanOrEqual(3_600);
    expect(decodeGuilds(encoded)?.[0]?.id).toBe("100199");
  });

  test("un cookie absent ou abîmé donne null", () => {
    expect(decodeGuilds(undefined)).toBeNull();
    expect(decodeGuilds("{pas du json")).toBeNull();
    expect(decodeGuilds('{"a":1}')).toBeNull();
  });
});

describe("guildIconUrl", () => {
  test("construit l'adresse du CDN, ou null sans image", () => {
    expect(guildIconUrl({ id: "123456", icon: "a".repeat(32) })).toBe(
      `https://cdn.discordapp.com/icons/123456/${"a".repeat(32)}.png?size=64`,
    );
    expect(guildIconUrl({ id: "123456", icon: null })).toBeNull();
  });

  test("refuse un hash d'icône inattendu", () => {
    expect(parseDiscordGuilds([{ id: "123456", name: "x", icon: "../../evil" }])[0]?.icon).toBeNull();
  });
});

describe("inviteUrl", () => {
  test("sans identifiant d'application, pas de lien", () => {
    delete process.env.NEXT_PUBLIC_DISCORD_APPLICATION_ID;
    expect(inviteUrl("123456")).toBeNull();
  });

  test("avec identifiant, présélectionne le serveur", () => {
    process.env.NEXT_PUBLIC_DISCORD_APPLICATION_ID = "999";
    const url = new URL(inviteUrl("123456") ?? "");
    expect(url.searchParams.get("client_id")).toBe("999");
    expect(url.searchParams.get("guild_id")).toBe("123456");
    delete process.env.NEXT_PUBLIC_DISCORD_APPLICATION_ID;
  });

  test("lien de la page d'accueil : le visiteur choisit le serveur", () => {
    expect(botInviteUrl()).toBeNull();
    process.env.NEXT_PUBLIC_DISCORD_APPLICATION_ID = "999";
    const url = new URL(botInviteUrl() ?? "");
    expect(url.searchParams.get("client_id")).toBe("999");
    expect(url.searchParams.get("scope")).toBe("bot applications.commands");
    expect(url.searchParams.has("guild_id")).toBe(false);
    delete process.env.NEXT_PUBLIC_DISCORD_APPLICATION_ID;
  });
});

describe("bannière", () => {
  test("gardée seulement pour les serveurs gérables (les seules lignes qui l'affichent)", () => {
    const [managed, member] = parseDiscordGuilds([
      { id: "111111", name: "A", owner: true, banner: "d".repeat(32) },
      { id: "222222", name: "B", permissions: "0", banner: "e".repeat(32) },
    ]);

    expect(managed?.banner).toBe("d".repeat(32));
    expect(member?.banner).toBeNull();
  });

  test("adresse du CDN, ou null sans bannière ou avec un hash inattendu", () => {
    expect(guildBannerUrl({ id: "123456", banner: "a_" + "f".repeat(32) })).toBe(
      `https://cdn.discordapp.com/banners/123456/a_${"f".repeat(32)}.png?size=600`,
    );
    expect(guildBannerUrl({ id: "123456", banner: null })).toBeNull();
    expect(guildBannerUrl({ id: "123456", banner: "../x" })).toBeNull();
  });
});

describe("memberAvatarUrl", () => {
  test("adresse du CDN de la photo d'un membre, ou null sans photo ou avec une valeur inattendue", () => {
    expect(memberAvatarUrl("123456", "a".repeat(32))).toBe(`https://cdn.discordapp.com/avatars/123456/${"a".repeat(32)}.png?size=64`);
    expect(memberAvatarUrl("123456", null)).toBeNull();
    expect(memberAvatarUrl("123456", "../x")).toBeNull();
    expect(memberAvatarUrl("pas-un-id", "a".repeat(32))).toBeNull();
  });
});

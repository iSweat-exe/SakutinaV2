import { describe, expect, test } from "bun:test";

import { loadNativeAddon } from "@sakutina/native";

import { formatNumber, formatVoiceTime } from "@/discord/formatting.ts";
import { buildProfileCardInput } from "@/discord/commands/profile/profile-card-content.ts";
import { countersWith } from "@/domain/activity/counters.ts";
import { emptyAccount } from "@/domain/economy/economy-types.ts";

const data = {
  displayName: "Camille",
  guildName: "Uwu Server",
  totals: countersWith({ messages: 1204, voiceSeconds: 11_100, joins: 1 }),
  account: { ...emptyAccount("g", "m"), wallet: 12_450, bank: 250_000 },
  avatar: null,
};

describe("contenu de la carte", () => {
  test("construit quatre statistiques formatées", () => {
    expect(buildProfileCardInput(data)).toEqual({
      title: "Camille",
      subtitle: "Uwu Server",
      stats: [
        { label: "Messages", value: "1 204" },
        { label: "Vocal", value: "3 h 05 min" },
        { label: "Portefeuille", value: "12,5 k" },
        { label: "Banque", value: "250 k" },
      ],
    });
  });

  test("omet l'avatar et le sous-titre quand ils manquent", () => {
    const input = buildProfileCardInput({ ...data, guildName: "" });

    expect(input).not.toHaveProperty("subtitle");
    expect(input).not.toHaveProperty("avatar");
    expect(buildProfileCardInput({ ...data, avatar: new Uint8Array([1]) })).toHaveProperty(
      "avatar",
    );
  });

  test("les nombres sont exacts jusqu'à 9 999 puis abrégés, avec des espaces ordinaires seulement", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(1_250)).toBe("1 250");
    expect(formatNumber(9_999)).toBe("9 999");
    expect(formatNumber(10_000)).toBe("10 k");
    expect(formatNumber(12_450)).toBe("12,5 k");
    expect(formatNumber(500_200)).toBe("500,2 k");
    expect(formatNumber(1_000_000)).toBe("1 M");
    expect(formatNumber(1_234_567)).toBe("1,2 M");
    expect(formatNumber(-500_200)).toBe("-500,2 k");

    for (const value of [1_250, 12_450, 1_234_567]) {
      expect(formatNumber(value)).not.toMatch(/[  ]/);
    }
  });

  test("formate le temps vocal", () => {
    expect(formatVoiceTime(0)).toBe("0 min");
    expect(formatVoiceTime(59)).toBe("0 min");
    expect(formatVoiceTime(42 * 60)).toBe("42 min");
    expect(formatVoiceTime(3 * 3600 + 5 * 60)).toBe("3 h 05 min");
    expect(formatVoiceTime(-10)).toBe("0 min");
  });
});

const native = loadNativeAddon();

// Exige `bun run native:build` ; la CI le compile avant les tests.
describe.skipIf(!native.ok)("addon natif Rust", () => {
  const addon = native.ok ? native.addon : null;

  function size(png: Uint8Array): [number, number] {
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength);

    return [view.getUint32(16), view.getUint32(20)];
  }

  test("renvoie un PNG de 840 × 300", async () => {
    const png = await addon!.renderProfileCard(buildProfileCardInput(data));

    expect([...png.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(size(png)).toEqual([840, 300]);
  });

  test("est déterministe et dépend du contenu", async () => {
    const first = await addon!.renderProfileCard(buildProfileCardInput(data));
    const second = await addon!.renderProfileCard(buildProfileCardInput(data));
    const other = await addon!.renderProfileCard(
      buildProfileCardInput({ ...data, displayName: "Zoé" }),
    );

    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true);
    expect(Buffer.from(first).equals(Buffer.from(other))).toBe(false);
  });

  test("accepte un avatar illisible sans échouer", async () => {
    const png = await addon!.renderProfileCard(
      buildProfileCardInput({ ...data, avatar: new TextEncoder().encode("pas une image") }),
    );

    expect(size(png)).toEqual([840, 300]);
  });

  test("rejette une demande invalide avec un message clair", async () => {
    await expect(addon!.renderProfileCard({ title: "x", stats: [] })).rejects.toThrow(
      "between 1 and 6 stats",
    );
    await expect(
      addon!.renderProfileCard({
        title: "x",
        accent: "rouge",
        stats: [{ label: "a", value: "b" }],
      }),
    ).rejects.toThrow("#RRGGBB");
  });

  test("rend plusieurs cartes en parallèle", async () => {
    const cards = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        addon!.renderProfileCard(buildProfileCardInput({ ...data, displayName: `Membre ${index}` })),
      ),
    );

    expect(cards).toHaveLength(20);
    expect(cards.every((png) => size(png)[0] === 840)).toBe(true);
  });
});

import { describe, expect, test } from "bun:test";

import { DEFAULT_AUTOMOD } from "@/domain/guilds/guild-types.ts";
import {
  BURST_MESSAGES,
  MENTION_LIMIT,
  SpamWindow,
  evaluateAutomod,
  matchesBannedWord,
  type MessageFacts,
} from "@/domain/moderation/automod.ts";

const on = { ...DEFAULT_AUTOMOD, spam: true, links: true, words: true, mentions: true, bannedWords: ["arnaque", "c++"] };
const facts = (over: Partial<MessageFacts> = {}): MessageFacts => ({
  guildId: "g",
  memberId: "m",
  text: "bonjour",
  mentionedUsers: 0,
  memberAgeDays: 400,
  at: 1_000_000,
  ...over,
});

describe("filtre de mentions", () => {
  test("plus de 5 personnes d'un coup : suppression et mute", () => {
    expect(evaluateAutomod(facts({ mentionedUsers: MENTION_LIMIT }), on, new SpamWindow())).toBeNull();
    expect(evaluateAutomod(facts({ mentionedUsers: MENTION_LIMIT + 1 }), on, new SpamWindow())).toEqual({ rule: "mentions", punish: true });
  });
});

describe("filtre de spam", () => {
  test("une rafale de messages dans la fenêtre déclenche, des messages espacés non", () => {
    const window = new SpamWindow();
    const results = Array.from({ length: BURST_MESSAGES }, (_, i) =>
      evaluateAutomod(facts({ text: `message ${i}`, at: 1_000 + i * 500 }), on, window),
    );

    expect(results.slice(0, -1).every((result) => result === null)).toBe(true);
    expect(results.at(-1)).toEqual({ rule: "spam", punish: true });

    const slow = new SpamWindow();
    for (let i = 0; i < 10; i++) {
      expect(evaluateAutomod(facts({ text: `message ${i}`, at: i * 20_000 }), on, slow)).toBeNull();
    }
  });

  test("le même message trois fois en 30 secondes déclenche, quelle que soit la casse ou les espaces", () => {
    const window = new SpamWindow();

    expect(evaluateAutomod(facts({ text: "Achetez  ICI", at: 0 }), on, window)).toBeNull();
    expect(evaluateAutomod(facts({ text: "achetez ici", at: 5_000 }), on, window)).toBeNull();
    expect(evaluateAutomod(facts({ text: " ACHETEZ ici ", at: 10_000 }), on, window)?.rule).toBe("spam");
  });

  test("chaque membre a sa propre fenêtre, et on peut l'oublier ou la balayer", () => {
    const window = new SpamWindow();

    for (let i = 0; i < BURST_MESSAGES - 1; i++) {
      window.observe("g", "a", `x${i}`, i);
    }

    expect(window.observe("g", "b", "autre", 10)).toBe(false);
    window.forget("g", "a");
    expect(window.observe("g", "a", "y", 11)).toBe(false);
    window.sweep(1_000_000);
    expect(window.size).toBe(0);
  });

  test("règle éteinte : rien n'est mesuré", () => {
    const window = new SpamWindow();

    for (let i = 0; i < 20; i++) {
      expect(evaluateAutomod(facts({ text: "pareil", at: i }), { ...on, spam: false }, window)).toBeNull();
    }

    expect(window.size).toBe(0);
  });
});

describe("filtre de liens", () => {
  const link = "regarde https://exemple.com/promo";

  test("supprime le lien d'un membre arrivé depuis moins de 7 jours, sans mute", () => {
    expect(evaluateAutomod(facts({ text: link, memberAgeDays: 2 }), on, new SpamWindow())).toEqual({ rule: "links", punish: false });
    expect(evaluateAutomod(facts({ text: "rejoins discord.gg/abc123", memberAgeDays: 0.1 }), on, new SpamWindow())?.rule).toBe("links");
    expect(evaluateAutomod(facts({ text: "www.exemple.fr", memberAgeDays: 1 }), on, new SpamWindow())?.rule).toBe("links");
  });

  test("laisse passer un membre établi, un arrivé inconnu, un message sans lien et la règle éteinte", () => {
    expect(evaluateAutomod(facts({ text: link, memberAgeDays: 7 }), on, new SpamWindow())).toBeNull();
    expect(evaluateAutomod(facts({ text: link, memberAgeDays: null }), on, new SpamWindow())).toBeNull();
    expect(evaluateAutomod(facts({ text: "pas de lien ici", memberAgeDays: 1 }), on, new SpamWindow())).toBeNull();
    expect(evaluateAutomod(facts({ text: link, memberAgeDays: 1 }), { ...on, links: false }, new SpamWindow())).toBeNull();
  });
});

describe("filtre de mots interdits", () => {
  test("mots entiers, sans tenir compte de la casse", () => {
    expect(matchesBannedWord("Quelle ARNAQUE !", ["arnaque"])).toBe(true);
    expect(matchesBannedWord("arnaques en série", ["arnaque"])).toBe(false);
    expect(matchesBannedWord("pré-arnaque", ["arnaque"])).toBe(true);
    expect(matchesBannedWord("j'aime le c++ !", ["c++"])).toBe(true);
    expect(matchesBannedWord("rien", [])).toBe(false);
    expect(matchesBannedWord("rien", ["  "])).toBe(false);
  });

  test("supprime sans mute, seulement si la règle est active", () => {
    expect(evaluateAutomod(facts({ text: "une arnaque" }), on, new SpamWindow())).toEqual({ rule: "words", punish: false });
    expect(evaluateAutomod(facts({ text: "une arnaque" }), { ...on, words: false }, new SpamWindow())).toBeNull();
  });

  test("un caractère spécial dans la liste n'est jamais interprété comme une expression régulière", () => {
    expect(matchesBannedWord("a.b", [".*"])).toBe(false);
    expect(matchesBannedWord("(x", ["(x"])).toBe(true);
  });
});

test("toutes les règles éteintes : jamais de violation", () => {
  expect(evaluateAutomod(facts({ text: "https://x.fr arnaque", mentionedUsers: 50, memberAgeDays: 0 }), DEFAULT_AUTOMOD, new SpamWindow())).toBeNull();
});

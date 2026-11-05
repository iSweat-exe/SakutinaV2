import { expect, test } from "bun:test";

import { PhaethonTracker } from "@/domain/phaethon/phaethon-tracker.ts";
import { PresenceSessions } from "@/domain/phaethon/presence-sessions.ts";
import { VoiceCoPresence } from "@/domain/phaethon/voice-copresence.ts";

const at = (seconds: number) => new Date(Date.UTC(2026, 10, 5, 12, 0, seconds));

test("les interactions s'additionnent par jour et un membre n'interagit pas avec lui-même", () => {
  const tracker = new PhaethonTracker();

  tracker.recordInteraction("g", "a", "b", at(0), { replies: 1 });
  tracker.recordInteraction("g", "a", "b", at(30), { replies: 1, mentions: 2 });
  tracker.recordInteraction("g", "a", "a", at(0), { replies: 5 });

  const { edges } = tracker.drain();

  expect(edges).toHaveLength(1);
  expect(edges[0]).toMatchObject({ memberId: "a", targetId: "b", replies: 2, mentions: 2, reactions: 0 });
  expect(tracker.drain().edges).toEqual([]);
});

test("restore réintègre un lot sans rien perdre ni doubler", () => {
  const tracker = new PhaethonTracker();

  tracker.recordInteraction("g", "a", "b", at(0), { reactions: 1 });
  tracker.recordMessageHour("g", "a", at(0));
  tracker.recordStatusSeconds("g", "a", "online", 60, at(0));
  tracker.recordGameSeconds("g", "a", "Celeste", "playing", 90, at(0));
  tracker.recordIdentity({
    id: "e1",
    guildId: "g",
    memberId: "a",
    kind: "nickname",
    oldValue: null,
    newValue: "Nouveau",
    at: at(0),
  });
  const batch = tracker.drain();

  tracker.recordInteraction("g", "a", "b", at(5), { reactions: 1 });
  tracker.restore(batch);

  const merged = tracker.drain();

  expect(merged.edges[0]?.reactions).toBe(2);
  expect(merged.hours[0]?.messages).toBe(1);
  expect(merged.statuses[0]?.seconds).toBe(60);
  expect(merged.games[0]).toMatchObject({ name: "Celeste", seconds: 90 });
  expect(merged.identity).toHaveLength(1);
});

test("forget efface un membre comme source et comme cible, et rien d'autre", () => {
  const tracker = new PhaethonTracker();

  tracker.recordInteraction("g", "a", "b", at(0), { replies: 1 });
  tracker.recordInteraction("g", "b", "a", at(0), { replies: 1 });
  tracker.recordInteraction("g", "b", "c", at(0), { replies: 1 });
  tracker.recordMessageHour("g", "a", at(0));
  tracker.recordMessageHour("g", "c", at(0));

  tracker.forget("g", "a");
  const batch = tracker.drain();

  expect(batch.edges.map((edge) => `${edge.memberId}>${edge.targetId}`)).toEqual(["b>c"]);
  expect(batch.hours.map((row) => row.memberId)).toEqual(["c"]);
});

test("les noms de jeux vides sont ignorés et les textes longs tronqués", () => {
  const tracker = new PhaethonTracker();

  tracker.recordGameSeconds("g", "a", "   ", "playing", 10, at(0));
  tracker.recordGameSeconds("g", "a", "x".repeat(300), "playing", 10, at(0));

  const { games } = tracker.drain();

  expect(games).toHaveLength(1);
  expect(games[0]?.name).toHaveLength(100);
});

test("les sessions de présence créditent le statut et chaque activité, puis se ferment hors ligne", () => {
  const statuses: [string, number][] = [];
  const games: [string, number][] = [];
  const sessions = new PresenceSessions({
    status: (_g, _m, status, seconds) => statuses.push([status, seconds]),
    game: (_g, _m, name, _kind, seconds) => games.push([name, seconds]),
  });

  sessions.observe("g", "a", { status: "online", games: [{ name: "Celeste", kind: "playing" }] }, at(0));
  sessions.observe("g", "a", { status: "idle", games: [] }, at(100));
  sessions.observe("g", "a", { status: "offline", games: [] }, at(160));
  sessions.checkpoint(at(500));

  expect(statuses).toEqual([
    ["online", 100],
    ["idle", 60],
  ]);
  expect(games).toEqual([["Celeste", 100]]);
  expect(sessions.activeCount).toBe(0);
});

test("le point de contrôle de présence ne double pas le temps déjà crédité", () => {
  const statuses: number[] = [];
  const sessions = new PresenceSessions({
    status: (_g, _m, _s, seconds) => statuses.push(seconds),
    game: () => undefined,
  });

  sessions.hydrate([{ guildId: "g", memberId: "a", observed: { status: "dnd", games: [] } }], at(0));
  sessions.checkpoint(at(60));
  sessions.checkpoint(at(60));
  sessions.closeAll(at(90));

  expect(statuses).toEqual([60, 30]);
});

test("la présence simultanée en vocal crédite chaque paire dans les deux sens", () => {
  const pairs: string[] = [];
  const copresence = new VoiceCoPresence((_g, a, b, seconds) => pairs.push(`${a}>${b}:${seconds}`), 25);

  copresence.join("g", "a", "c1", at(0));
  copresence.join("g", "b", "c1", at(100));
  copresence.leave("g", "a", at(160));
  copresence.leave("g", "b", at(200));

  // a et b ne sont ensemble que de 100 s à 160 s.
  expect(pairs.sort()).toEqual(["a>b:60", "b>a:60"]);
});

test("un déplacement quitte l'ancien salon et un salon trop peuplé est ignoré", () => {
  const pairs: string[] = [];
  const copresence = new VoiceCoPresence((_g, a, b, seconds) => pairs.push(`${a}>${b}:${seconds}`), 2);

  copresence.join("g", "a", "c1", at(0));
  copresence.join("g", "b", "c1", at(0));
  copresence.move("g", "b", "c2", at(30));
  copresence.join("g", "c", "c2", at(30));
  copresence.join("g", "d", "c2", at(30));
  copresence.checkpoint(at(90));

  expect(pairs.sort()).toEqual(["a>b:30", "b>a:30"]);
});

test("le point de contrôle vocal ne double pas le temps et hydrate remplace l'état", () => {
  const pairs: string[] = [];
  const copresence = new VoiceCoPresence((_g, a, b, seconds) => pairs.push(`${a}>${b}:${seconds}`), 25);

  copresence.hydrate(
    [
      { guildId: "g", memberId: "a", channelId: "c" },
      { guildId: "g", memberId: "b", channelId: "c" },
    ],
    at(0),
  );
  copresence.checkpoint(at(60));
  copresence.checkpoint(at(60));
  copresence.closeAll(at(90));

  expect(pairs.sort()).toEqual(["a>b:30", "a>b:60", "b>a:30", "b>a:60"]);
});

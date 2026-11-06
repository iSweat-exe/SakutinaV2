import { describe, expect, test } from "bun:test";

import { MemoryRaidStore } from "@/database/in-memory/memory-raid-store.ts";
import { accountCreatedAt, DEFAULT_ANTI_RAID, joinWeight, RAID_CALM_MS, type AntiRaidSettings } from "@/domain/anti-raid/anti-raid-rules.ts";
import { AntiRaidService } from "@/domain/anti-raid/anti-raid-service.ts";
import { JoinBurstDetector } from "@/domain/anti-raid/join-burst.ts";
import { alreadyLocked, LOCK_BITS, lockedOverwrite, restoredOverwrite } from "@/domain/anti-raid/overwrites.ts";

const DAY = 86_400_000;
const NOW = new Date("2026-11-06T12:00:00Z");
/** Identifiant Discord d'un compte créé il y a `days` jours. */
const snowflake = (days: number, n = 0) => String(((BigInt(NOW.getTime() - days * DAY) - 1_420_070_400_000n) << 22n) + BigInt(n));
const settings = (overrides: Partial<AntiRaidSettings> = {}): AntiRaidSettings => ({ ...DEFAULT_ANTI_RAID, enabled: true, ...overrides });
const at = (seconds: number) => new Date(NOW.getTime() + seconds * 1_000);

describe("règles", () => {
  test("la date de création d'un compte se lit dans son identifiant", () => {
    expect(Math.abs(accountCreatedAt(snowflake(3))!.getTime() - (NOW.getTime() - 3 * DAY))).toBeLessThan(1_000);
    expect(accountCreatedAt("pas-un-id")).toBeNull();
  });

  test("un compte plus jeune que le seuil compte double", () => {
    expect(joinWeight(snowflake(2), NOW, 7)).toBe(2);
    expect(joinWeight(snowflake(30), NOW, 7)).toBe(1);
    expect(joinWeight(snowflake(2), NOW, 0)).toBe(1);
  });
});

describe("détection des rafales", () => {
  test("le raid est déclaré quand les arrivées pondérées atteignent le seuil dans la fenêtre", () => {
    const detector = new JoinBurstDetector();
    const rules = settings({ joinThreshold: 4, windowSeconds: 10, minAccountAgeDays: 0 });

    expect(detector.record("g", "1000001", at(0), rules)).toMatchObject({ kind: "calm", weighted: 1 });
    expect(detector.record("g", "1000002", at(2), rules).kind).toBe("calm");
    expect(detector.record("g", "1000003", at(4), rules).kind).toBe("calm");
    expect(detector.record("g", "1000004", at(6), rules)).toEqual({
      kind: "started",
      weighted: 4,
      memberIds: ["1000001", "1000002", "1000003", "1000004"],
    });
  });

  test("les arrivées sorties de la fenêtre ne comptent plus, ni un autre serveur", () => {
    const detector = new JoinBurstDetector();
    const rules = settings({ joinThreshold: 3, windowSeconds: 10, minAccountAgeDays: 0 });

    detector.record("g", "1000001", at(0), rules);
    detector.record("autre", "1000002", at(1), rules);
    detector.record("g", "1000003", at(11), rules);
    expect(detector.record("g", "1000004", at(12), rules)).toMatchObject({ kind: "calm", weighted: 2 });
  });

  test("les comptes récents déclenchent plus vite ; éteint, rien n'est déclaré", () => {
    const detector = new JoinBurstDetector();

    detector.record("g", snowflake(1, 1), NOW, settings({ joinThreshold: 4 }));
    expect(detector.record("g", snowflake(1, 2), NOW, settings({ joinThreshold: 4 })).kind).toBe("started");
    expect(new JoinBurstDetector().record("g", "1000001", NOW, settings({ enabled: false, joinThreshold: 3 })).kind).toBe("calm");
  });

  test("pendant un raid, chaque arrivée en fait partie ; une rafale finit après 2 minutes de calme, un verrouillage manuel jamais", () => {
    const detector = new JoinBurstDetector();
    detector.begin("g", "raid-1", NOW, false);
    detector.begin("m", "raid-2", NOW, true);

    expect(detector.record("g", "1000009", at(30), settings())).toEqual({ kind: "raider", raidId: "raid-1" });
    expect(detector.sweep(new Date(at(30).getTime() + RAID_CALM_MS - 1))).toEqual([]);
    expect(detector.sweep(new Date(at(30).getTime() + RAID_CALM_MS))).toEqual([{ guildId: "g", raidId: "raid-1", joins: 1 }]);
    expect(detector.active("g")).toBeNull();
    expect(detector.active("m")?.manual).toBe(true);
  });
});

describe("verrouillage réversible", () => {
  const SEND = 1n << 11n;
  const VIEW = 1n << 10n;

  test("verrouiller refuse les bits du verrouillage et garde les autres", () => {
    const locked = lockedOverwrite({ allow: String(VIEW | SEND), deny: "0" });

    expect(BigInt(locked.allow)).toBe(VIEW);
    expect(BigInt(locked.deny)).toBe(LOCK_BITS);
    expect(lockedOverwrite(null)).toEqual({ allow: "0", deny: String(LOCK_BITS) });
  });

  test("un salon où @everyone ne peut déjà plus écrire n'est pas touché", () => {
    expect(alreadyLocked({ allow: "0", deny: String(SEND) })).toBe(true);
    expect(alreadyLocked(null)).toBe(false);
  });

  test("rétablir rend exactement l'état d'avant, sans effacer un changement fait pendant le raid", () => {
    const before = { allow: String(SEND), deny: "0" };
    const locked = lockedOverwrite(before);
    // Pendant le raid, un admin a caché le salon (VIEW refusé).
    const during = { allow: locked.allow, deny: String(BigInt(locked.deny) | VIEW) };

    expect(restoredOverwrite(before, locked)).toEqual(before);
    expect(restoredOverwrite(before, during)).toEqual({ allow: String(SEND), deny: String(VIEW) });
  });

  test("sans surcharge avant, la surcharge est supprimée s'il n'en reste rien", () => {
    expect(restoredOverwrite(null, lockedOverwrite(null))).toBeNull();
    expect(restoredOverwrite(null, { allow: String(VIEW), deny: String(LOCK_BITS) })).toEqual({ allow: String(VIEW), deny: "0" });
  });
});

describe("service", () => {
  const service = (rules = settings({ joinThreshold: 3, minAccountAgeDays: 0 })) => {
    const store = new MemoryRaidStore();
    let now = NOW;
    const antiRaid = new AntiRaidService(store, async () => rules, () => now);
    return { store, antiRaid, advance: (ms: number) => (now = new Date(now.getTime() + ms)) };
  };

  test("une rafale enregistre un raid ; les arrivées suivantes s'y ajoutent", async () => {
    const { store, antiRaid } = service();

    expect((await antiRaid.onJoin("g", "1000001", at(0))).kind).toBe("calm");
    await antiRaid.onJoin("g", "1000002", at(1));
    const started = await antiRaid.onJoin("g", "1000003", at(2));

    expect(started.kind).toBe("started");
    if (started.kind !== "started") return;
    expect(started.memberIds).toHaveLength(3);
    expect(await antiRaid.onJoin("g", "1000004", at(3))).toMatchObject({ kind: "raider", raidId: started.raid.id });
    expect((await store.find(started.raid.id))?.joins).toBe(4);
  });

  test("un seul raid à la fois ; la fin le clôt avec son auteur", async () => {
    const { antiRaid, store } = service();
    const manual = await antiRaid.startManual("g", "admin");

    expect(manual?.raid.trigger).toBe("manual");
    expect(await antiRaid.startManual("g", "admin")).toBeNull();

    const ended = await antiRaid.end("g", "admin");
    expect(ended).toMatchObject({ endedBy: "admin", trigger: "manual" });
    expect(ended?.endedAt).not.toBeNull();
    expect(await store.active()).toEqual([]);
    expect(await antiRaid.end("g", "admin")).toBeNull();
  });

  test("une rafale calme depuis 2 minutes se clôt seule ; un raid ouvert reprend après un redémarrage", async () => {
    const { antiRaid, store, advance } = service();

    for (const id of ["1000001", "1000002", "1000003"]) {
      await antiRaid.onJoin("g", id, NOW);
    }

    advance(RAID_CALM_MS);
    const ended = await antiRaid.endCalmed();
    expect(ended).toHaveLength(1);
    expect(ended[0]?.endedBy).toBeNull();

    await store.start({ id: "r2", guildId: "h", startedAt: NOW, trigger: "manual", startedBy: "a", joins: 0, windowSeconds: 30, action: "kick" });
    const restarted = new AntiRaidService(store, async () => settings());
    await restarted.resume();
    expect(restarted.active("h")).toMatchObject({ raidId: "r2", manual: true });
  });

  test("l'état d'avant le verrouillage est gardé jusqu'à ce que chaque salon soit rétabli", async () => {
    const { antiRaid } = service();
    const started = await antiRaid.startManual("g", "admin");
    const raidId = started!.raid.id;

    await antiRaid.saveLockdown(raidId, "g", [{ channelId: "c1", overwrite: null }, { channelId: "c2", overwrite: { allow: "1", deny: "0" } }], 1);
    // Une seconde copie (verrouillage repris) ne remplace pas la première.
    await antiRaid.saveLockdown(raidId, "g", [{ channelId: "c1", overwrite: { allow: "0", deny: "2048" } }], null);
    await antiRaid.forgetChannel(raidId, "c2");

    expect(await antiRaid.lockdown(raidId)).toEqual({ channels: [{ channelId: "c1", overwrite: null }], verificationBefore: 1 });
  });
});

describe("casino coupé", () => {
  test("tous les jeux fermés, plafonds gardés pour la réouverture", async () => {
    const { closeAllGames, defaultCasinoSettings } = await import("@/domain/casino/casino-rules.ts");
    const open = { ...defaultCasinoSettings(), roulette: { enabled: false, maxBet: 77 } };
    const closed = closeAllGames(open);

    expect(Object.values(closed).every((game) => !game.enabled)).toBe(true);
    expect(closed.roulette.maxBet).toBe(77);
    expect(open.slots.enabled).toBe(true);
  });
});

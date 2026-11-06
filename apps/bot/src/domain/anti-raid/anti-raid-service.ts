import { RAID_RETENTION_DAYS, type AntiRaidSettings } from "./anti-raid-rules.ts";
import { JoinBurstDetector } from "./join-burst.ts";
import type { ChannelSnapshot } from "./overwrites.ts";
import type { Raid, RaidCommand, RaidCounts, RaidStore } from "./raid-store.ts";

const DAY_MS = 86_400_000;
/** Demandes du panneau traitées : gardées 30 jours, comme le journal d'audit. */
const COMMAND_RETENTION_DAYS = 30;

/** Ce que l'arrivée d'un membre change, une fois le raid enregistré. */
export type JoinOutcome =
  | Readonly<{ kind: "calm" }>
  /** Un raid commence : `memberIds` sont les comptes arrivés dans la fenêtre (celui-ci compris). */
  | Readonly<{ kind: "started"; raid: Raid; memberIds: readonly string[]; settings: AntiRaidSettings }>
  | Readonly<{ kind: "raider"; raidId: string; settings: AntiRaidSettings }>;

/**
 * L'anti-raid côté règles : détecte les rafales, tient les raids en base (un seul à la fois par serveur) et ce qu'il
 * faudra rétablir. N'agit jamais sur Discord : `discord/anti-raid/raid-guard.ts` exécute.
 */
export class AntiRaidService {
  private readonly detector = new JoinBurstDetector();

  constructor(
    private readonly store: RaidStore,
    private readonly settingsOf: (guildId: string) => Promise<AntiRaidSettings>,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  settings(guildId: string): Promise<AntiRaidSettings> {
    return this.settingsOf(guildId);
  }

  /** Au démarrage : les raids encore ouverts reprennent ; une rafale finit 2 minutes plus tard si tout est calme. */
  async resume(): Promise<readonly Raid[]> {
    const raids = await this.store.active();
    const now = this.clock();

    for (const raid of raids) {
      this.detector.begin(raid.guildId, raid.id, raid.startedAt, raid.trigger === "manual", raid.joins, now);
    }

    return raids;
  }

  async onJoin(guildId: string, memberId: string, at = this.clock()): Promise<JoinOutcome> {
    const settings = await this.settingsOf(guildId);
    const verdict = this.detector.record(guildId, memberId, at, settings);

    if (verdict.kind === "raider") {
      await this.store.addCounts(verdict.raidId, { joins: 1 });
      return { kind: "raider", raidId: verdict.raidId, settings };
    }

    if (verdict.kind === "calm") {
      return { kind: "calm" };
    }

    // Le raid est ouvert tout de suite en mémoire : les arrivées qui suivent pendant l'écriture en font déjà partie.
    const raidId = crypto.randomUUID();
    this.detector.begin(guildId, raidId, at, false, verdict.memberIds.length);

    const raid = await this.store.start({
      id: raidId,
      guildId,
      startedAt: at,
      trigger: "burst",
      startedBy: null,
      joins: verdict.memberIds.length,
      windowSeconds: settings.windowSeconds,
      action: settings.action,
    });

    // Un raid est déjà ouvert en base (verrouillage manuel d'une autre source) : celui-là sert.
    if (!raid) {
      const open = (await this.store.active()).find((r) => r.guildId === guildId);

      if (open) {
        this.detector.begin(guildId, open.id, open.startedAt, open.trigger === "manual", open.joins, at);
        await this.store.addCounts(open.id, { joins: 1 });
        return { kind: "raider", raidId: open.id, settings };
      }

      this.detector.end(guildId);
      return { kind: "calm" };
    }

    return { kind: "started", raid, memberIds: verdict.memberIds, settings };
  }

  /** Verrouillage demandé par un administrateur ; `null` si un raid est déjà en cours. */
  async startManual(guildId: string, by: string): Promise<Readonly<{ raid: Raid; settings: AntiRaidSettings }> | null> {
    if (this.detector.active(guildId)) {
      return null;
    }

    const settings = await this.settingsOf(guildId);
    const at = this.clock();
    const raid = await this.store.start({
      id: crypto.randomUUID(),
      guildId,
      startedAt: at,
      trigger: "manual",
      startedBy: by,
      joins: 0,
      windowSeconds: settings.windowSeconds,
      action: settings.action,
    });

    if (!raid) {
      return null;
    }

    this.detector.begin(guildId, raid.id, at, true);

    return { raid, settings };
  }

  active(guildId: string): Readonly<{ raidId: string; startedAt: Date; manual: boolean; joins: number }> | null {
    return this.detector.active(guildId);
  }

  /** Lève le raid en cours (`by` : administrateur, `null` : fin automatique) ; renvoie son bilan, ou `null` s'il n'y en avait pas. */
  async end(guildId: string, by: string | null): Promise<Raid | null> {
    const active = this.detector.active(guildId);

    if (!active) {
      return null;
    }

    this.detector.end(guildId);
    return this.close(active.raidId, by);
  }

  /** Raids déclarés par une rafale et calmes depuis 2 minutes : clos, avec leur bilan. */
  async endCalmed(): Promise<readonly Raid[]> {
    const ended: Raid[] = [];

    for (const calmed of this.detector.sweep(this.clock())) {
      const raid = await this.close(calmed.raidId, null);

      if (raid) {
        ended.push(raid);
      }
    }

    return ended;
  }

  count(raidId: string, counts: RaidCounts): Promise<void> {
    return this.store.addCounts(raidId, counts);
  }

  saveLockdown(raidId: string, guildId: string, channels: readonly ChannelSnapshot[], verificationBefore: number | null): Promise<void> {
    return this.store.saveLockdown(raidId, guildId, channels, verificationBefore);
  }

  lockdown(raidId: string) {
    return this.store.lockdown(raidId);
  }

  forgetChannel(raidId: string, channelId: string): Promise<void> {
    return this.store.forgetChannel(raidId, channelId);
  }

  pendingCommands(limit = 10): Promise<readonly RaidCommand[]> {
    return this.store.pendingCommands(limit);
  }

  finishCommand(id: string, status: "done" | "failed", error?: string): Promise<void> {
    return this.store.finishCommand(id, status, this.clock(), error);
  }

  purgeExpired(now = this.clock()): Promise<number> {
    return this.store.purge(
      new Date(now.getTime() - RAID_RETENTION_DAYS * DAY_MS),
      new Date(now.getTime() - COMMAND_RETENTION_DAYS * DAY_MS),
    );
  }

  private async close(raidId: string, by: string | null): Promise<Raid | null> {
    await this.store.end(raidId, this.clock(), by);
    return this.store.find(raidId);
  }
}

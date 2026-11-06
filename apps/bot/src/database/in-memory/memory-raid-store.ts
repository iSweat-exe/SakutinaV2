import type { ChannelSnapshot } from "@/domain/anti-raid/overwrites.ts";
import type { NewRaid, Raid, RaidCommand, RaidCounts, RaidStore } from "@/domain/anti-raid/raid-store.ts";

type Command = RaidCommand & { status: "pending" | "done" | "failed"; requestedAt: number; processedAt: Date | null; error: string | null };

/** Stockage de développement et de test : perdu au redémarrage. */
export class MemoryRaidStore implements RaidStore {
  readonly raids = new Map<string, Raid>();
  readonly channels = new Map<string, Map<string, ChannelSnapshot>>();
  readonly commands: Command[] = [];

  async start(raid: NewRaid): Promise<Raid | null> {
    if ([...this.raids.values()].some((r) => r.guildId === raid.guildId && r.endedAt === null)) {
      return null;
    }

    const created: Raid = {
      ...raid,
      endedAt: null,
      endedBy: null,
      actioned: 0,
      failed: 0,
      lockedChannels: 0,
      verificationBefore: null,
    };
    this.raids.set(created.id, created);

    return created;
  }

  async active(): Promise<readonly Raid[]> {
    return [...this.raids.values()].filter((raid) => raid.endedAt === null);
  }

  async find(raidId: string): Promise<Raid | null> {
    return this.raids.get(raidId) ?? null;
  }

  async addCounts(raidId: string, counts: RaidCounts): Promise<void> {
    const raid = this.raids.get(raidId);

    if (raid) {
      this.raids.set(raidId, {
        ...raid,
        joins: raid.joins + (counts.joins ?? 0),
        actioned: raid.actioned + (counts.actioned ?? 0),
        failed: raid.failed + (counts.failed ?? 0),
        lockedChannels: raid.lockedChannels + (counts.lockedChannels ?? 0),
      });
    }
  }

  async saveLockdown(raidId: string, _guildId: string, channels: readonly ChannelSnapshot[], verificationBefore: number | null): Promise<void> {
    const raid = this.raids.get(raidId);

    if (raid && verificationBefore !== null) {
      this.raids.set(raidId, { ...raid, verificationBefore });
    }

    const saved = this.channels.get(raidId) ?? new Map<string, ChannelSnapshot>();

    for (const snapshot of channels) {
      if (!saved.has(snapshot.channelId)) {
        saved.set(snapshot.channelId, snapshot);
      }
    }

    this.channels.set(raidId, saved);
  }

  async lockdown(raidId: string) {
    return {
      channels: [...(this.channels.get(raidId)?.values() ?? [])],
      verificationBefore: this.raids.get(raidId)?.verificationBefore ?? null,
    };
  }

  async forgetChannel(raidId: string, channelId: string): Promise<void> {
    this.channels.get(raidId)?.delete(channelId);
  }

  async end(raidId: string, at: Date, by: string | null): Promise<boolean> {
    const raid = this.raids.get(raidId);

    if (!raid || raid.endedAt !== null) {
      return false;
    }

    this.raids.set(raidId, { ...raid, endedAt: at, endedBy: by });
    return true;
  }

  async pendingCommands(limit: number): Promise<readonly RaidCommand[]> {
    return this.commands
      .filter((command) => command.status === "pending")
      .sort((a, b) => a.requestedAt - b.requestedAt)
      .slice(0, limit)
      .map(({ id, guildId, action, requestedBy }) => ({ id, guildId, action, requestedBy }));
  }

  async enqueueCommand(guildId: string, action: "start" | "end", requestedBy: string): Promise<void> {
    this.commands.push({ id: crypto.randomUUID(), guildId, action, requestedBy, status: "pending", requestedAt: this.commands.length, processedAt: null, error: null });
  }

  async finishCommand(id: string, status: "done" | "failed", at: Date, error?: string): Promise<void> {
    const command = this.commands.find((c) => c.id === id);

    if (command) {
      command.status = status;
      command.processedAt = at;
      command.error = error ?? null;
    }
  }

  async purge(raidsBefore: Date, commandsBefore: Date): Promise<number> {
    let removed = 0;

    for (const [id, raid] of this.raids) {
      if (raid.endedAt && raid.endedAt < raidsBefore) {
        this.raids.delete(id);
        this.channels.delete(id);
        removed += 1;
      }
    }

    for (let i = this.commands.length - 1; i >= 0; i--) {
      const processedAt = this.commands[i]!.processedAt;

      if (processedAt && processedAt < commandsBefore) {
        this.commands.splice(i, 1);
        removed += 1;
      }
    }

    return removed;
  }
}

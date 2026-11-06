import { and, asc, eq, isNotNull, isNull, lt, sql } from "drizzle-orm";

import { RAID_ACTIONS, type RaidAction } from "@/domain/anti-raid/anti-raid-rules.ts";
import type { ChannelSnapshot } from "@/domain/anti-raid/overwrites.ts";
import type { NewRaid, Raid, RaidCommand, RaidCounts, RaidStore } from "@/domain/anti-raid/raid-store.ts";
import type { Database } from "../connection.ts";
import { raidCommand, raidEvent, raidLockdownChannel } from "../schema/index.ts";

type Row = typeof raidEvent.$inferSelect;

const toRaid = (row: Row): Raid => ({
  id: row.id,
  guildId: row.guildId,
  startedAt: row.startedAt,
  endedAt: row.endedAt,
  trigger: row.trigger === "manual" ? "manual" : "burst",
  startedBy: row.startedBy,
  endedBy: row.endedBy,
  joins: row.joins,
  windowSeconds: row.windowSeconds,
  action: (RAID_ACTIONS as readonly string[]).includes(row.action) ? (row.action as RaidAction) : "watch",
  actioned: row.actioned,
  failed: row.failed,
  lockedChannels: row.lockedChannels,
  verificationBefore: row.verificationBefore,
});

export class PostgresRaidStore implements RaidStore {
  constructor(private readonly db: Database) {}

  async start(raid: NewRaid): Promise<Raid | null> {
    // L'index unique partiel garantit un seul raid ouvert par serveur, même entre deux instances du bot.
    const [row] = await this.db
      .insert(raidEvent)
      .values(raid)
      .onConflictDoNothing()
      .returning();

    return row ? toRaid(row) : null;
  }

  async active(): Promise<readonly Raid[]> {
    return (await this.db.select().from(raidEvent).where(isNull(raidEvent.endedAt))).map(toRaid);
  }

  async find(raidId: string): Promise<Raid | null> {
    const [row] = await this.db.select().from(raidEvent).where(eq(raidEvent.id, raidId)).limit(1);
    return row ? toRaid(row) : null;
  }

  async addCounts(raidId: string, counts: RaidCounts): Promise<void> {
    await this.db
      .update(raidEvent)
      .set({
        joins: sql`${raidEvent.joins} + ${counts.joins ?? 0}`,
        actioned: sql`${raidEvent.actioned} + ${counts.actioned ?? 0}`,
        failed: sql`${raidEvent.failed} + ${counts.failed ?? 0}`,
        lockedChannels: sql`${raidEvent.lockedChannels} + ${counts.lockedChannels ?? 0}`,
      })
      .where(eq(raidEvent.id, raidId));
  }

  async saveLockdown(raidId: string, guildId: string, channels: readonly ChannelSnapshot[], verificationBefore: number | null): Promise<void> {
    await this.db.transaction(async (tx) => {
      if (verificationBefore !== null) {
        await tx.update(raidEvent).set({ verificationBefore }).where(eq(raidEvent.id, raidId));
      }

      if (channels.length > 0) {
        await tx
          .insert(raidLockdownChannel)
          .values(
            channels.map(({ channelId, overwrite }) => ({
              raidId,
              guildId,
              channelId,
              hadOverwrite: overwrite !== null,
              allow: overwrite?.allow ?? "0",
              deny: overwrite?.deny ?? "0",
            })),
          )
          // Déjà enregistré (verrouillage repris) : la première copie, celle d'avant toute modification, fait foi.
          .onConflictDoNothing();
      }
    });
  }

  async lockdown(raidId: string) {
    const [raid] = await this.db.select({ verificationBefore: raidEvent.verificationBefore }).from(raidEvent).where(eq(raidEvent.id, raidId));
    const rows = await this.db.select().from(raidLockdownChannel).where(eq(raidLockdownChannel.raidId, raidId));

    return {
      verificationBefore: raid?.verificationBefore ?? null,
      channels: rows.map((row) => ({
        channelId: row.channelId,
        overwrite: row.hadOverwrite ? { allow: row.allow, deny: row.deny } : null,
      })),
    };
  }

  async forgetChannel(raidId: string, channelId: string): Promise<void> {
    await this.db
      .delete(raidLockdownChannel)
      .where(and(eq(raidLockdownChannel.raidId, raidId), eq(raidLockdownChannel.channelId, channelId)));
  }

  async end(raidId: string, at: Date, by: string | null): Promise<boolean> {
    const rows = await this.db
      .update(raidEvent)
      .set({ endedAt: at, endedBy: by })
      .where(and(eq(raidEvent.id, raidId), isNull(raidEvent.endedAt)))
      .returning({ id: raidEvent.id });

    return rows.length > 0;
  }

  async pendingCommands(limit: number): Promise<readonly RaidCommand[]> {
    const rows = await this.db
      .select()
      .from(raidCommand)
      .where(eq(raidCommand.status, "pending"))
      .orderBy(asc(raidCommand.requestedAt))
      .limit(limit);

    return rows.flatMap(({ id, guildId, action, requestedBy }): RaidCommand[] =>
      action === "start" || action === "end" ? [{ id, guildId, action, requestedBy }] : [],
    );
  }

  async enqueueCommand(guildId: string, action: "start" | "end", requestedBy: string): Promise<void> {
    await this.db.insert(raidCommand).values({ guildId, action, requestedBy });
  }

  async finishCommand(id: string, status: "done" | "failed", at: Date, error?: string): Promise<void> {
    await this.db
      .update(raidCommand)
      .set({ status, processedAt: at, error: error?.slice(0, 300) ?? null })
      .where(eq(raidCommand.id, id));
  }

  async purge(raidsBefore: Date, commandsBefore: Date): Promise<number> {
    const raids = await this.db
      .delete(raidEvent)
      .where(and(isNotNull(raidEvent.endedAt), lt(raidEvent.endedAt, raidsBefore)))
      .returning({ id: raidEvent.id });
    const commands = await this.db
      .delete(raidCommand)
      .where(and(isNotNull(raidCommand.processedAt), lt(raidCommand.processedAt, commandsBefore)))
      .returning({ id: raidCommand.id });

    return raids.length + commands.length;
  }
}

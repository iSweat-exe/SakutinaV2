import { and, asc, eq, gt, isNull, lt, or, sql } from "drizzle-orm";

import type {
  NewSanction,
  Sanction,
  SanctionCommand,
  SanctionKind,
  SanctionStore,
} from "@/domain/moderation/sanction-store.ts";
import type { Database } from "../connection.ts";
import { moderationCommand, moderationSanction } from "../schema/index.ts";

type Row = typeof moderationSanction.$inferSelect;

const toSanction = (row: Row): Sanction => ({ ...row, kind: row.kind as SanctionKind });

const activeAt = (now: Date) =>
  and(
    isNull(moderationSanction.revokedAt),
    or(isNull(moderationSanction.endsAt), gt(moderationSanction.endsAt, now)),
  );

export class PostgresSanctionStore implements SanctionStore {
  constructor(private readonly db: Database) {}

  async add(sanction: NewSanction): Promise<Sanction> {
    return this.db.transaction(async (tx) => {
      await tx
        .update(moderationSanction)
        .set({ revokedAt: sanction.createdAt, revokedBy: null })
        .where(
          and(
            eq(moderationSanction.guildId, sanction.guildId),
            eq(moderationSanction.memberId, sanction.memberId),
            eq(moderationSanction.kind, sanction.kind),
            activeAt(sanction.createdAt),
          ),
        );

      const [row] = await tx.insert(moderationSanction).values(sanction).returning();

      if (!row) {
        throw new Error("Sanction insert returned no row");
      }

      return toSanction(row);
    });
  }

  async close(guildId: string, memberId: string, kind: SanctionKind, at: Date, by: string | null): Promise<number> {
    const closed = await this.db
      .update(moderationSanction)
      .set({ revokedAt: at, revokedBy: by })
      .where(
        and(
          eq(moderationSanction.guildId, guildId),
          eq(moderationSanction.memberId, memberId),
          eq(moderationSanction.kind, kind),
          activeAt(at),
        ),
      )
      .returning({ id: moderationSanction.id });

    return closed.length;
  }

  async find(id: number): Promise<Sanction | null> {
    const [row] = await this.db.select().from(moderationSanction).where(eq(moderationSanction.id, id));

    return row ? toSanction(row) : null;
  }

  async hasActive(guildId: string, memberId: string, kind: SanctionKind, now: Date): Promise<boolean> {
    const [row] = await this.db
      .select({ id: moderationSanction.id })
      .from(moderationSanction)
      .where(
        and(
          eq(moderationSanction.guildId, guildId),
          eq(moderationSanction.memberId, memberId),
          eq(moderationSanction.kind, kind),
          activeAt(now),
        ),
      )
      .limit(1);

    return row !== undefined;
  }

  async purgeClosedBefore(before: Date): Promise<number> {
    const removed = await this.db
      .delete(moderationSanction)
      .where(sql`coalesce(${moderationSanction.revokedAt}, ${moderationSanction.endsAt}) < ${before.toISOString()}::timestamptz`)
      .returning({ id: moderationSanction.id });

    // Les demandes traitées depuis longtemps n'ont plus d'intérêt non plus.
    await this.db
      .delete(moderationCommand)
      .where(and(sql`${moderationCommand.status} <> 'pending'`, lt(moderationCommand.processedAt, before)));

    return removed.length;
  }

  async enqueueCommand(guildId: string, sanctionId: number, requestedBy: string): Promise<void> {
    await this.db.insert(moderationCommand).values({ guildId, sanctionId, requestedBy });
  }

  async pendingCommands(limit: number): Promise<readonly SanctionCommand[]> {
    const rows = await this.db
      .select()
      .from(moderationCommand)
      .where(eq(moderationCommand.status, "pending"))
      .orderBy(asc(moderationCommand.requestedAt))
      .limit(limit);

    return rows.map(({ id, guildId, sanctionId, requestedBy }) => ({ id, guildId, sanctionId, requestedBy }));
  }

  async finishCommand(id: string, status: "done" | "failed", at: Date, error?: string): Promise<void> {
    await this.db
      .update(moderationCommand)
      .set({ status, processedAt: at, error: error?.slice(0, 300) ?? null })
      .where(eq(moderationCommand.id, id));
  }
}

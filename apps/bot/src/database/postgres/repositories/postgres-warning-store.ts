import { and, count, desc, eq, lt } from "drizzle-orm";

import type { NewWarning, Warning } from "@/domain/moderation/moderation-types.ts";
import type { WarningStore } from "@/domain/moderation/warning-store.ts";
import type { Database } from "../connection.ts";
import { moderationWarning } from "../schema/index.ts";

export class PostgresWarningStore implements WarningStore {
  constructor(private readonly db: Database) {}

  async add(warning: NewWarning): Promise<Warning> {
    const [row] = await this.db.insert(moderationWarning).values(warning).returning();

    if (!row) {
      throw new Error("Warning insert returned no row");
    }

    return row;
  }

  async listForMember(guildId: string, memberId: string, limit: number): Promise<readonly Warning[]> {
    return this.db
      .select()
      .from(moderationWarning)
      .where(and(eq(moderationWarning.guildId, guildId), eq(moderationWarning.memberId, memberId)))
      .orderBy(desc(moderationWarning.createdAt), desc(moderationWarning.id))
      .limit(limit);
  }

  async count(guildId: string, memberId: string): Promise<number> {
    const [row] = await this.db
      .select({ total: count() })
      .from(moderationWarning)
      .where(and(eq(moderationWarning.guildId, guildId), eq(moderationWarning.memberId, memberId)));

    return Number(row?.total ?? 0);
  }

  async remove(guildId: string, id: number): Promise<boolean> {
    const removed = await this.db
      .delete(moderationWarning)
      .where(and(eq(moderationWarning.guildId, guildId), eq(moderationWarning.id, id)))
      .returning({ id: moderationWarning.id });

    return removed.length > 0;
  }

  async purgeBefore(before: Date): Promise<number> {
    const removed = await this.db
      .delete(moderationWarning)
      .where(lt(moderationWarning.createdAt, before))
      .returning({ id: moderationWarning.id });

    return removed.length;
  }
}

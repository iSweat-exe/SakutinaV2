import { WARNING_RETENTION_DAYS } from "./moderation-rules.ts";
import type { Warning } from "./moderation-types.ts";
import type { WarningStore } from "./warning-store.ts";

const DAY_MS = 86_400_000;
const LIST_LIMIT = 10;

/** Avertissements : donnés, listés, retirés, et purgés après un an. */
export class ModerationService {
  constructor(
    private readonly store: WarningStore,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  warn(guildId: string, memberId: string, moderatorId: string, reason: string): Promise<Warning> {
    return this.store.add({ guildId, memberId, moderatorId, reason, createdAt: this.clock() });
  }

  async warnings(
    guildId: string,
    memberId: string,
  ): Promise<Readonly<{ total: number; latest: readonly Warning[] }>> {
    const [total, latest] = await Promise.all([
      this.store.count(guildId, memberId),
      this.store.listForMember(guildId, memberId, LIST_LIMIT),
    ]);

    return { total, latest };
  }

  remove(guildId: string, id: number): Promise<boolean> {
    return this.store.remove(guildId, id);
  }

  purgeExpired(now = this.clock()): Promise<number> {
    return this.store.purgeBefore(new Date(now.getTime() - WARNING_RETENTION_DAYS * DAY_MS));
  }
}

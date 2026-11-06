import type { AppConfig } from "@sakutina/config";

import { MemoryActivityStore } from "@/database/in-memory/memory-activity-store.ts";
import { MemoryAuditLog } from "@/database/in-memory/memory-audit-log.ts";
import { MemoryWarningStore } from "@/database/in-memory/memory-warning-store.ts";
import { MemoryPhaethonStore } from "@/database/in-memory/memory-phaethon-store.ts";
import { MemoryMemberStore } from "@/database/in-memory/memory-member-store.ts";
import { MemoryEconomyStore } from "@/database/in-memory/memory-economy-store.ts";
import { MemoryGuildStore } from "@/database/in-memory/memory-guild-store.ts";
import { MemorySanctionStore } from "@/database/in-memory/memory-sanction-store.ts";
import { MemoryRaidStore } from "@/database/in-memory/memory-raid-store.ts";
import { connectPostgres } from "@/database/postgres/connection.ts";
import { migrate } from "@/database/postgres/migrate.ts";
import { PostgresActivityStore } from "@/database/postgres/repositories/postgres-activity-store.ts";
import { PostgresAuditLog } from "@/database/postgres/repositories/postgres-audit-log.ts";
import { PostgresWarningStore } from "@/database/postgres/repositories/postgres-warning-store.ts";
import { PostgresPhaethonStore } from "@/database/postgres/repositories/postgres-phaethon-store.ts";
import { PostgresMemberStore } from "@/database/postgres/repositories/postgres-member-store.ts";
import { PostgresEconomyStore } from "@/database/postgres/repositories/postgres-economy-store.ts";
import { PostgresGuildStore } from "@/database/postgres/repositories/postgres-guild-store.ts";
import { PostgresSanctionStore } from "@/database/postgres/repositories/postgres-sanction-store.ts";
import { PostgresRaidStore } from "@/database/postgres/repositories/postgres-raid-store.ts";
import type { ActivityStore } from "@/domain/activity/activity-store.ts";
import type { AuditLog } from "@/domain/audit/audit-event.ts";
import type { EconomyStore } from "@/domain/economy/economy-store.ts";
import type { GuildStore } from "@/domain/guilds/guild-store.ts";
import type { SanctionStore } from "@/domain/moderation/sanction-store.ts";
import type { RaidStore } from "@/domain/anti-raid/raid-store.ts";
import type { WarningStore } from "@/domain/moderation/warning-store.ts";
import type { PhaethonStore } from "@/domain/phaethon/phaethon-store.ts";
import type { MemberStore } from "@/domain/members/member-store.ts";
import { logger } from "@/shared/logger.ts";

export type Storage = Readonly<{
  activityStore: ActivityStore;
  auditLog: AuditLog;
  economyStore: EconomyStore;
  guildStore: GuildStore;
  sanctionStore: SanctionStore;
  raidStore: RaidStore;
  memberStore: MemberStore;
  phaethonStore: PhaethonStore;
  warningStore: WarningStore;
  close: () => Promise<void>;
}>;

/**
 * Choisit l'implémentation des stockages : PostgreSQL (migrations appliquées)
 * quand `DATABASE_URL` est définie, sinon la mémoire (développement seulement).
 */
export async function createStorage(config: AppConfig): Promise<Storage> {
  if (!config.databaseUrl) {
    logger.warn("DATABASE_URL not set: using in-memory storage (data lost on restart)");

    return {
      activityStore: new MemoryActivityStore(),
      auditLog: new MemoryAuditLog(),
      economyStore: new MemoryEconomyStore(),
      guildStore: new MemoryGuildStore(),
      sanctionStore: new MemorySanctionStore(),
      raidStore: new MemoryRaidStore(),
      memberStore: new MemoryMemberStore(),
      phaethonStore: new MemoryPhaethonStore(),
      warningStore: new MemoryWarningStore(),
      close: async () => undefined,
    };
  }

  const postgres = connectPostgres(config.databaseUrl);
  const applied = await migrate(postgres.db);
  logger.info("Database ready", { migrationsApplied: applied.length });

  return {
    activityStore: new PostgresActivityStore(postgres.db),
    auditLog: new PostgresAuditLog(postgres.db),
    economyStore: new PostgresEconomyStore(postgres.db),
    guildStore: new PostgresGuildStore(postgres.db),
    sanctionStore: new PostgresSanctionStore(postgres.db),
    raidStore: new PostgresRaidStore(postgres.db),
    memberStore: new PostgresMemberStore(postgres.db),
    phaethonStore: new PostgresPhaethonStore(postgres.db),
    warningStore: new PostgresWarningStore(postgres.db),
    close: () => postgres.close().catch(() => undefined),
  };
}

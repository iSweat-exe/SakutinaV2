import { expect, test } from "bun:test";

import { MemoryAuditLog } from "@/database/in-memory/memory-audit-log.ts";
import { MemorySanctionStore } from "@/database/in-memory/memory-sanction-store.ts";
import { createPanelCommandRunner } from "@/discord/moderation/panel-commands.ts";
import { SanctionService } from "@/domain/moderation/sanction-service.ts";

const GUILD = "g";

function scene(over: { bansFail?: number; noMember?: boolean; noGuild?: boolean } = {}) {
  const calls = { unbans: [] as string[], timeouts: [] as (number | null)[] };
  const member = { timeout: async (ms: number | null) => void calls.timeouts.push(ms) };
  const guild = {
    id: GUILD,
    bans: {
      remove: async (id: string) => {
        if (over.bansFail) throw Object.assign(new Error("boom"), { code: over.bansFail });
        calls.unbans.push(id);
      },
    },
    members: { fetch: async () => (over.noMember ? Promise.reject(new Error("Unknown Member")) : member) },
  };
  const client = { guilds: { cache: new Map(over.noGuild ? [] : [[GUILD, guild]]) } } as never;
  const store = new MemorySanctionStore();
  const sanctionService = new SanctionService(store);
  const auditLog = new MemoryAuditLog();
  const run = createPanelCommandRunner({ client, sanctionService, auditLog });

  return { run, store, sanctionService, auditLog, calls };
}

const audits = async (auditLog: MemoryAuditLog) => (await auditLog.listForGuild(GUILD, 10)).map((e) => [e.action, e.actorId, e.targetId, e.metadata.result, e.metadata.source]);

test("lever un bannissement : unban sur Discord, sanction close, audit au nom de l'administrateur, demande terminée", async () => {
  const { run, store, sanctionService, auditLog, calls } = scene();
  const ban = await sanctionService.recordBan(GUILD, "cible", "mod", "raid");
  await store.enqueueCommand(GUILD, ban.id, "admin-1");

  await run();

  expect(calls.unbans).toEqual(["cible"]);
  expect(await store.find(ban.id)).toMatchObject({ revokedBy: "admin-1" });
  expect(await audits(auditLog)).toEqual([["moderation.unban", "admin-1", "cible", "ok", "panel"]]);
  expect(await store.pendingCommands(10)).toEqual([]);
});

test("lever un mute : le timeout est retiré", async () => {
  const { run, store, sanctionService, auditLog, calls } = scene();
  const mute = await sanctionService.recordMute(GUILD, "cible", "mod", "spam", 3_600_000);
  await store.enqueueCommand(GUILD, mute.id, "admin-1");

  await run();

  expect(calls.timeouts).toEqual([null]);
  expect((await store.find(mute.id))?.revokedAt).not.toBeNull();
  expect((await audits(auditLog))[0]).toEqual(["moderation.untimeout", "admin-1", "cible", "ok", "panel"]);
});

test("un membre parti ou un bannissement déjà levé dans Discord : la sanction est close sans erreur", async () => {
  const gone = scene({ noMember: true });
  const mute = await gone.sanctionService.recordMute(GUILD, "parti", "mod", "x", 3_600_000);
  await gone.store.enqueueCommand(GUILD, mute.id, "admin-1");
  await gone.run();
  expect((await gone.store.find(mute.id))?.revokedAt).not.toBeNull();

  const unknownBan = scene({ bansFail: 10_026 });
  const ban = await unknownBan.sanctionService.recordBan(GUILD, "x", "mod", "x");
  await unknownBan.store.enqueueCommand(GUILD, ban.id, "admin-1");
  await unknownBan.run();
  expect((await unknownBan.store.find(ban.id))?.revokedAt).not.toBeNull();
  expect(await unknownBan.store.pendingCommands(10)).toEqual([]);
});

test("un refus de Discord laisse la sanction active, journalise l'échec et clôt la demande", async () => {
  const { run, store, sanctionService, auditLog } = scene({ bansFail: 50_013 });
  const ban = await sanctionService.recordBan(GUILD, "cible", "mod", "raid");
  await store.enqueueCommand(GUILD, ban.id, "admin-1");

  await run();

  expect((await store.find(ban.id))?.revokedAt).toBeNull();
  expect((await audits(auditLog))[0]).toEqual(["moderation.unban", "admin-1", "cible", "failed", "panel"]);
  expect(await store.pendingCommands(10)).toEqual([]);
});

test("sanction déjà levée, ou bot parti du serveur : la demande est close sans rien tenter de plus", async () => {
  const done = scene();
  const old = await done.sanctionService.recordBan(GUILD, "cible", "mod", "x");
  await done.sanctionService.clear("ban", GUILD, "cible", "autre");
  await done.store.enqueueCommand(GUILD, old.id, "admin-1");
  await done.run();
  expect(done.calls.unbans).toEqual([]);
  expect(await done.store.pendingCommands(10)).toEqual([]);

  const away = scene({ noGuild: true });
  const ban = await away.sanctionService.recordBan(GUILD, "cible", "mod", "x");
  await away.store.enqueueCommand(GUILD, ban.id, "admin-1");
  await away.run();
  expect((await away.store.find(ban.id))?.revokedAt).toBeNull();
  expect(await away.store.pendingCommands(10)).toEqual([]);
});

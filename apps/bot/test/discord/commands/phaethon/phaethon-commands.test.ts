import { expect, test } from "bun:test";

import { compareCommand } from "@/discord/commands/phaethon/compare.ts";
import { profileCommand } from "@/discord/commands/phaethon/profile.ts";
import { searchCommand } from "@/discord/commands/phaethon/search.ts";
import { describeIdentityEvent } from "@/discord/commands/phaethon/dossier-panel.ts";
import { messages } from "@/discord/messages.ts";
import {
  GUILD,
  ME,
  OTHER,
  commandInteraction,
  createContext,
  isEphemeral,
  user,
} from "../../../support/fakes.ts";
import { textOf } from "../../../support/panel-text.ts";

const other = user(OTHER, "Autre");
const me = user(ME, "Moi");
const facts = { characters: 5, isReply: false, attachments: 0, mentions: 0 };

test("/profile est privé, journalisé et montre l'identité d'un autre membre", async () => {
  const { context, auditLog, phaethonTracker } = createContext();
  phaethonTracker.recordInteraction(GUILD, OTHER, ME, new Date(), { reactions: 3 });
  phaethonTracker.recordGameSeconds(GUILD, OTHER, "Celeste", "playing", 3_600, new Date());
  const command = commandInteraction({ users: { member: other } });

  await profileCommand.execute(command.fake, context, { role: "admin" });

  const text = textOf(command.replies[0]);

  expect(isEphemeral(command.replies[0])).toBe(true);
  expect(text).toContain("Autre");
  expect(text).toContain(`<@${ME}>`);
  expect(text).toContain("Celeste");
  expect(text).toContain("aucune donnée de contenu");

  const [event] = await auditLog.listForGuild(GUILD, 5);

  expect(event).toMatchObject({ action: "profile.viewed", actorId: ME, targetId: OTHER });
});

test("/profile sur soi-même n'affiche ni nom ni avatar en en-tête", async () => {
  const { context } = createContext();
  const self = commandInteraction({ users: { member: me } });
  const target = commandInteraction({ users: { member: other } });

  await profileCommand.execute(self.fake, context, { role: "admin" });
  await profileCommand.execute(target.fake, context, { role: "admin" });

  expect(textOf(self.replies[0])).not.toContain("-# Moi");
  expect(textOf(target.replies[0])).toContain("-# Autre");
  expect(JSON.stringify(self.replies[0])).not.toContain("cdn.test");
  expect(JSON.stringify(target.replies[0])).toContain("cdn.test");
});

test("/search combine les critères, reste privée et journalise les critères", async () => {
  const { context, auditLog, tracker, phaethonTracker } = createContext();

  for (let i = 0; i < 30; i += 1) {
    tracker.recordMessage(GUILD, OTHER, "c", new Date("2026-11-05T23:00:00Z"), facts);
    phaethonTracker.recordMessageHour(GUILD, OTHER, new Date("2026-11-05T23:00:00Z"));
  }

  const command = commandInteraction({ integers: { min_messages: 10 }, booleans: { night_owl: true } });

  await searchCommand.execute(command.fake, context, { role: "admin" });

  const text = textOf(command.replies[0]);

  expect(isEphemeral(command.replies[0])).toBe(true);
  expect(text).toContain(`<@${OTHER}>`);
  expect(text).not.toContain(`<@${ME}>`);
  expect(text).toContain("≥ 10 msg");

  const [event] = await auditLog.listForGuild(GUILD, 5);

  expect(event).toMatchObject({ action: "profile.searched", actorId: ME });
  expect(String(event?.metadata.criteria)).toContain("≥ 10 msg");
});

test("/search sans résultat le dit", async () => {
  const { context } = createContext();
  const command = commandInteraction({ strings: { game: "Inconnu" } });

  await searchCommand.execute(command.fake, context, { role: "admin" });

  expect(textOf(command.replies[0])).toContain(messages.phaethon.search.empty);
});

test("/compare affiche les deux membres, ce qu'ils s'échangent et journalise", async () => {
  const { context, auditLog, phaethonTracker } = createContext();
  phaethonTracker.recordInteraction(GUILD, ME, OTHER, new Date(), { replies: 2 });
  const command = commandInteraction({ users: { member_a: me, member_b: other } });

  await compareCommand.execute(command.fake, context, { role: "admin" });

  const text = textOf(command.replies[0]);

  expect(isEphemeral(command.replies[0])).toBe(true);
  expect(text).toContain(`<@${ME}>`);
  expect(text).toContain(`<@${OTHER}>`);
  expect(text).toContain("**2** réponses");

  const [event] = await auditLog.listForGuild(GUILD, 5);

  expect(event).toMatchObject({ action: "profile.compared", targetId: ME, metadata: { other: OTHER } });
});

test("les changements d'identité sont décrits sans laisser passer de mention ni de Markdown", () => {
  const base = { id: "e", guildId: GUILD, memberId: ME, at: new Date() };

  expect(
    describeIdentityEvent({ ...base, kind: "nickname", oldValue: null, newValue: "**@everyone**" }),
  ).toBe("Pseudo aucun → « \\*\\*\\@everyone\\*\\* »");
  expect(describeIdentityEvent({ ...base, kind: "roles", oldValue: null, newValue: "+1,-2" })).toBe(
    "Rôles +<@&1> -<@&2>",
  );
  expect(describeIdentityEvent({ ...base, kind: "boost", oldValue: null, newValue: "2026-11-05T00:00:00Z" })).toBe(
    "Boost activé",
  );
  expect(describeIdentityEvent({ ...base, kind: "timeout", oldValue: "x", newValue: null })).toBe("Timeout levé");
});

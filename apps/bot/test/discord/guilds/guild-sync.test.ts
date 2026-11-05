import { expect, test } from "bun:test";
import { PermissionFlagsBits, PermissionsBitField } from "discord.js";

import { managerIdsOf, snapshotGuild } from "@/discord/guilds/guild-sync.ts";

const member = (id: string, bot = false) => [id, { id, user: { bot } }] as const;
const role = (permissions: bigint, members: ReturnType<typeof member>[]) => ({
  permissions: new PermissionsBitField(permissions),
  members: new Map(members),
});

const guild = {
  id: "g",
  name: "Serveur",
  icon: "icone",
  banner: "banniere",
  ownerId: "proprio",
  memberCount: 42,
  roles: {
    cache: new Map([
      ["admin", role(PermissionFlagsBits.Administrator, [member("a"), member("robot", true)])],
      ["gestion", role(PermissionFlagsBits.ManageGuild, [member("b"), member("a")])],
      ["modo", role(PermissionFlagsBits.ModerateMembers, [member("c")])],
    ]),
  },
} as never;

test("gestionnaires : Administrateur ou « Gérer le serveur », sans les bots ni les simples modérateurs", () => {
  expect(managerIdsOf(guild).sort()).toEqual(["a", "b"]);
});

test("la fiche reprend nom, icône, bannière, propriétaire et nombre de membres", () => {
  expect(snapshotGuild(guild)).toEqual({
    guildId: "g",
    name: "Serveur",
    icon: "icone",
    banner: "banniere",
    ownerId: "proprio",
    memberCount: 42,
  });
});

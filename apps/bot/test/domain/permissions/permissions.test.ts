import { expect, test } from "bun:test";

import {
  hasRole,
  resolveRole,
  type RoleEvidence,
} from "@/domain/permissions/permissions.ts";

const mapping = { adminRoleIds: ["admin-role"], moderatorRoleIds: ["mod-role"] };
const none: RoleEvidence = {
  isGuildOwner: false,
  hasAdministrator: false,
  canModerate: false,
  memberRoleIds: [],
};

test("résout le rôle le plus élevé disponible", () => {
  expect(resolveRole({ ...none, isGuildOwner: true }, mapping)).toBe("owner");
  expect(resolveRole({ ...none, hasAdministrator: true }, mapping)).toBe("admin");
  expect(
    resolveRole({ ...none, memberRoleIds: ["admin-role"] }, mapping),
  ).toBe("admin");
  expect(resolveRole({ ...none, canModerate: true }, mapping)).toBe("moderator");
  expect(
    resolveRole({ ...none, memberRoleIds: ["mod-role"] }, mapping),
  ).toBe("moderator");
  expect(resolveRole(none, mapping)).toBe("member");
});

test("la hiérarchie des rôles est respectée", () => {
  expect(hasRole("owner", "admin")).toBe(true);
  expect(hasRole("admin", "admin")).toBe(true);
  expect(hasRole("moderator", "admin")).toBe(false);
  expect(hasRole("member", "moderator")).toBe(false);
});

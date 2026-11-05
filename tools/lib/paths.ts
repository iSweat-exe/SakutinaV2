import { fileURLToPath } from "node:url";
import { join } from "node:path";

/** Racine du dépôt (le dossier qui contient `tools/`). */
export const ROOT = fileURLToPath(new URL("../../", import.meta.url));

/** Chemins d'un dépôt donné : les générateurs reçoivent une racine jetable dans leurs tests. */
export const pathsFor = (root: string) =>
  ({
    root,
    bot: join(root, "apps/bot"),
    botSrc: join(root, "apps/bot/src"),
    botTest: join(root, "apps/bot/test"),
    migrations: join(root, "apps/bot/src/database/postgres/migrations"),
    panel: join(root, "apps/panel"),
    panelSrc: join(root, "apps/panel/src"),
    docs: join(root, "docs"),
  }) as const;

export type Paths = ReturnType<typeof pathsFor>;

export const path: Paths = pathsFor(ROOT);

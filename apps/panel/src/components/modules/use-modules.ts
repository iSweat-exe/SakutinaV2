"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toggleModule } from "@/app/servers/[guildId]/modules/actions";
import type { ModuleId, Modules } from "@/lib/panel-db/modules-schema";

const ERRORS = {
  forbidden: "You no longer manage this server.",
  invalid: "That change was refused.",
  unavailable: "The change could not be saved. Try again in a moment.",
} as const;

/**
 * Module switches shared by the dashboard, the Modules page and the "module off" screens: the switch moves at once,
 * then follows what the database saved (or goes back, with a message, if it refused).
 */
export function useModules(guildId: string, initial: Modules) {
  const router = useRouter();
  const [modules, setModules] = useState(initial);
  const [seen, setSeen] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Fresh data from the server (navigation, refresh) replaces what is shown.
  if (initial !== seen) {
    setSeen(initial);
    setModules(initial);
  }

  function toggle(module: ModuleId, enabled: boolean) {
    const before = modules;
    setModules({ ...modules, [module]: enabled });
    setError(null);
    start(async () => {
      const result = await toggleModule(guildId, module, enabled);

      if (result.ok) {
        setModules(result.modules);
        router.refresh();
      } else {
        setModules(before);
        setError(ERRORS[result.error]);
      }
    });
  }

  return { modules, toggle, error, pending };
}

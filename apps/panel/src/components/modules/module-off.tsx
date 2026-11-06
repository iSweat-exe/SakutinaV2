"use client";

import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import type { ModuleId, Modules } from "@/lib/panel-db/modules-schema";
import { useModules } from "./use-modules";

type Props = Readonly<{
  guildId: string;
  modules: Modules;
  module: ModuleId;
  title: string;
  /** What being off means for this module. */
  description: string;
}>;

/** In place of a module's page while the module is off, with the switch to turn it back on. */
export function ModuleOff({ guildId, modules: initial, module, title, description }: Props) {
  const { toggle, error, pending } = useModules(guildId, initial);

  return (
    <>
      <PageHeader title={title} description="This module is switched off for this server." />
      <Card label={`${title} is off`} className="items-start gap-3 px-5 py-[18px]">
        <div className="flex items-start gap-3">
          <Icon name="lock" size={20} className="mt-0.5 flex-none text-warning" />
          <div className="flex flex-col gap-1">
            <h2 className="m-0 font-display text-xl font-bold">{title} is off</h2>
            <p className="m-0 max-w-[64ch] text-sm leading-normal text-muted">{description}</p>
          </div>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => toggle(module, true)}
          className="min-h-11 cursor-pointer rounded-xl border border-transparent bg-accent px-5 text-sm font-semibold text-on-accent hover:brightness-110 disabled:cursor-wait disabled:opacity-55"
        >
          {pending ? "Turning on…" : `Turn ${title} on`}
        </button>
        {error ? (
          <p role="status" className="m-0 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </Card>
    </>
  );
}

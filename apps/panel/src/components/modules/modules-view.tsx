"use client";

import Link from "next/link";
import { useGuildHref } from "@/lib/guild-href";
import { Icon } from "@/components/ui/icon";
import { Locked } from "@/components/ui/locked";
import { PageHeader } from "@/components/ui/page-header";
import { Switch } from "@/components/ui/switch";
import type { IconName } from "@/lib/icons";
import type { ModuleId, Modules } from "@/lib/panel-db/modules-schema";
import { isModuleId } from "@/lib/panel-db/modules-schema";
import { useModules } from "./use-modules";

type ModuleDef = Readonly<{
  id: string;
  name: string;
  description: string;
  icon: IconName;
  /** Where "Configure" goes; null when the module has no page yet. */
  href: string | null;
  enabled: boolean;
}>;

const MODULES: ReadonlyArray<ModuleDef> = [
  { id: "antiraid", name: "Anti-Raid", description: "Detects coordinated joins and locks the server down before members are affected.", icon: "shield", href: "/anti-raid", enabled: true },
  { id: "moderation", name: "Moderation", description: "Mutes, bans, warnings and the automatic rules that apply them.", icon: "ban", href: "/moderation", enabled: true },
  { id: "phaethon", name: "Phaethon", description: "Flags suspicious accounts and queues them for your review.", icon: "eye", href: "/phaethon", enabled: true },
  { id: "balance", name: "Balance", description: "Coins, daily rewards and transfers between members.", icon: "coin", href: "/balance", enabled: true },
  { id: "casino", name: "Casino", description: "Slots, blackjack, roulette and coinflip, paid in server coins.", icon: "dice", href: "/casino", enabled: true },
  { id: "profiling", name: "Profiling", description: "Member profiles with messages, voice time and activity over time.", icon: "user", href: "/profiling", enabled: true },
  { id: "giveaways", name: "Giveaways", description: "Timed giveaways with automatic winner draws.", icon: "gift", href: null, enabled: true },
];

/** What switching a real module off does, under its description. */
const OFF_MEANS: Record<ModuleId, string> = {
  antiraid: "Off: joins are no longer watched. Lockdown stays available.",
  casino: "Off: every game is closed; each keeps its own setting.",
  phaethon: "Off: no alerts and the watchlist is hidden; metadata is still collected.",
  profiling: "Off: member profiles are hidden in this panel.",
};

export function ModulesView({ guildId, modules: initial }: Readonly<{ guildId: string; modules: Modules }>) {
  const guildHref = useGuildHref();
  const { modules, toggle, error, pending } = useModules(guildId, initial);
  const real = MODULES.filter((m) => isModuleId(m.id));
  const enabledCount = real.filter((m) => modules[m.id as ModuleId]).length;

  return (
    <>
      <PageHeader
        title="Modules"
        description="Switch features on or off for this server. Changes apply within seconds and are logged under your name."
        aside={
          <span className="text-sm font-semibold text-fg-soft">
            {enabledCount} of {real.length} switchable modules on
          </span>
        }
      />

      {error ? (
        <p role="status" className="m-0 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <section aria-label="Modules" className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr))]">
        {MODULES.map((module) => {
          const id = isModuleId(module.id) ? module.id : null;
          const on = id ? modules[id] : module.enabled;

          return (
            <div key={module.id} className="flex min-h-[210px] flex-col gap-4 rounded-2xl border border-line bg-card px-5 pt-[18px] pb-5">
              <div className="flex items-start justify-between gap-3">
                <span aria-hidden="true" className="flex size-12 flex-none items-center justify-center rounded-[14px] border border-line bg-raised">
                  <Icon name={module.icon} size={24} className={on ? "text-accent" : "text-muted"} />
                </span>
                {id ? (
                  <Switch label={module.name} checked={on} onChange={(next) => !pending && toggle(id, next)} />
                ) : (
                  // Modules without a stored on/off setting yet.
                  <Locked feature={module.id === "giveaways" ? "giveaways" : "settings"} compact className="rounded-xl">
                    <Switch label={module.name} checked={on} />
                  </Locked>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <h2 className="m-0 font-display text-[21px] font-bold">{module.name}</h2>
                <p className="m-0 text-[13.5px] leading-normal text-pretty text-muted">{module.description}</p>
                {id ? <p className="m-0 text-[12.5px] leading-normal text-muted">{OFF_MEANS[id]}</p> : null}
              </div>
              <div className="flex items-center justify-end gap-3">
                {module.href ? (
                  <Link
                    href={guildHref(module.href)}
                    className="box-border flex min-h-10 items-center rounded-[10px] border border-line-strong px-4 text-[13px] font-semibold text-fg no-underline hover:border-accent hover:bg-[#1f1a1a]"
                  >
                    Configure
                  </Link>
                ) : (
                  <span
                    aria-disabled="true"
                    title="Not built yet"
                    className="box-border flex min-h-10 cursor-not-allowed items-center rounded-[10px] border border-line px-4 text-[13px] font-semibold text-muted opacity-60"
                  >
                    Configure
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </>
  );
}

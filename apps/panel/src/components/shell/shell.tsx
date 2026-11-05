"use client";

import Link from "next/link";
import { Suspense, useState, type ReactNode } from "react";
import { GuildNav, GuildNavFallback } from "@/components/shell/guild-nav";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

type Props = Readonly<{
  /** "guild": navigation of one server. "servers": the server picker. */
  variant: "guild" | "servers";
  /** Server-rendered picture and name of the current server (streams in behind Suspense). */
  guild?: ReactNode;
  /** Server-rendered signed-in user chip (streams in behind Suspense). */
  user: ReactNode;
  children: ReactNode;
}>;

const EXPANDED = 285;
const COLLAPSED = 88;

/**
 * Page frame: collapsible sidebar + content. Collapse state lives here and is
 * exposed to the (server-rendered) children through `data-collapsed`, so they
 * adapt with `group-data-[collapsed=true]/side:` and need no props.
 */
export function Shell({ variant, guild, user, children }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const width = collapsed ? COLLAPSED : EXPANDED;

  return (
    <div className="box-border flex min-h-screen flex-wrap items-stretch gap-4 bg-bg p-4">
      <aside
        data-collapsed={collapsed}
        className="group/side box-border flex flex-col gap-3.5 rounded-[20px] border border-line bg-card px-3.5 pt-[18px] pb-3.5 min-[900px]:sticky min-[900px]:top-4 min-[900px]:h-[calc(100dvh-2rem)] min-[900px]:self-start min-[900px]:overflow-y-auto"
        style={{ flex: `0 0 ${width}px`, maxWidth: width }}
      >
        <div className="flex items-center justify-between border-b-2 border-accent px-1 pb-3 group-data-[collapsed=true]/side:justify-center">
          <span className="font-display text-[19px] font-bold group-data-[collapsed=true]/side:hidden">Sakutina</span>
          <button
            type="button"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((value) => !value)}
            className="flex size-11 flex-none cursor-pointer items-center justify-center rounded-xl border border-line-strong bg-transparent text-fg-soft hover:border-accent"
          >
            <Icon
              name="collapse"
              size={18}
              className={cn("transition-transform duration-200 motion-reduce:transition-none", collapsed && "rotate-180")}
            />
          </button>
        </div>

        {variant === "guild" ? (
          <>
            <Link
              href="/servers"
              title="Switch server"
              className="flex min-h-12 items-center gap-2.5 rounded-xl border border-line-strong bg-raised px-2.5 py-1.5 text-fg no-underline hover:border-accent group-data-[collapsed=true]/side:justify-center group-data-[collapsed=true]/side:px-1.5"
            >
              <span className="sr-clip">Switch server. Current server: </span>
              {guild}
              <Icon name="chevronsUpDown" size={16} className="text-muted group-data-[collapsed=true]/side:hidden" />
            </Link>

            <Suspense fallback={<GuildNavFallback />}>
              <GuildNav />
            </Suspense>

            {/* Panel settings do not exist yet: shown, not clickable. */}
            <div
              aria-disabled="true"
              title="Panel settings are not available yet"
              className="flex min-h-10 cursor-not-allowed items-center gap-2.5 rounded-[10px] border border-line px-2.5 text-sm font-medium text-fg-soft opacity-60 group-data-[collapsed=true]/side:justify-center"
            >
              <Icon name="sliders" className="text-muted" />
              <span className="group-data-[collapsed=true]/side:hidden">Settings</span>
            </div>
          </>
        ) : (
          <div className="flex min-h-[220px] flex-1 flex-col items-center justify-center gap-[18px] text-center text-sm text-muted">
            <svg
              aria-hidden="true"
              viewBox="0 0 76 76"
              fill="none"
              stroke="#6b6b72"
              strokeWidth="1.6"
              strokeLinejoin="round"
              className="size-[76px] group-data-[collapsed=true]/side:size-11"
            >
              <rect x="17" y="17" width="42" height="42" rx="8" transform="rotate(45 38 38)" />
            </svg>
            <span className="group-data-[collapsed=true]/side:hidden">Select a server…</span>
          </div>
        )}

        {user}
      </aside>

      {children}
    </div>
  );
}

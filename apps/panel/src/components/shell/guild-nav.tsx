"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { useGuildHref } from "@/lib/guild-href";
import { NAV_GROUPS } from "@/lib/nav";
import { cn } from "@/lib/cn";

const ITEM =
  "flex min-h-10 items-center gap-2.5 rounded-[10px] border px-2.5 text-sm font-medium no-underline group-data-[collapsed=true]/side:justify-center max-lg:min-h-11";

function Groups({ children }: Readonly<{ children: (item: (typeof NAV_GROUPS)[number]["items"][number]) => React.ReactNode }>) {
  return (
    <nav aria-label="Server sections" className="flex flex-1 flex-col gap-3">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <span className="px-2.5 text-xs font-medium tracking-[0.04em] text-muted group-data-[collapsed=true]/side:hidden">
            {group.label}
          </span>
          {group.items.map(children)}
        </div>
      ))}
    </nav>
  );
}

/**
 * Pages of the server being viewed. Reads the URL (server id, current page): on a dynamic
 * route this must render inside <Suspense>, with {@link GuildNavFallback} as the static shell.
 */
export function GuildNav() {
  const pathname = usePathname();
  const guildHref = useGuildHref();

  return (
    <Groups>
      {(item) => {
        const href = guildHref(item.href);
        const active = pathname === href;

        return (
          <Link
            key={item.href}
            href={href}
            aria-label={item.name}
            aria-current={active ? "page" : undefined}
            className={cn(
              ITEM,
              "hover:bg-[#1f1f22]",
              active ? "border-line-strong bg-selected text-white" : "border-transparent bg-transparent text-fg-dim",
            )}
          >
            <Icon name={item.icon} className={active ? "text-accent" : "text-muted"} />
            <span className="group-data-[collapsed=true]/side:hidden">{item.name}</span>
          </Link>
        );
      }}
    </Groups>
  );
}

/** Same layout without links, shown for the instant before the URL is known. */
export function GuildNavFallback() {
  return (
    <Groups>
      {(item) => (
        <span key={item.href} aria-hidden="true" className={cn(ITEM, "border-transparent text-fg-dim")}>
          <Icon name={item.icon} className="text-muted" />
          <span className="group-data-[collapsed=true]/side:hidden">{item.name}</span>
        </span>
      )}
    </Groups>
  );
}

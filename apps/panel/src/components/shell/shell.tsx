"use client";

import Link from "next/link";
import { Suspense, useEffect, useId, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
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
/** From this width the sidebar sits next to the page; below it, it is a drawer opened from the top bar. */
const DESKTOP = "(min-width: 1024px)";

const SQUARE_BUTTON =
  "flex size-11 flex-none cursor-pointer items-center justify-center rounded-xl border border-line-strong bg-transparent text-fg-soft hover:border-accent";

/**
 * Page frame: collapsible sidebar + content. Collapse state lives here and is
 * exposed to the (server-rendered) children through `data-collapsed`, so they
 * adapt with `group-data-[collapsed=true]/side:` and need no props.
 *
 * Below 1024 px the same sidebar becomes a drawer: a top bar opens it, and it closes on
 * Escape, on the backdrop, on its close button and whenever one of its links is followed.
 * While it is open the page behind is inert, so keyboard focus stays in the drawer.
 */
export function Shell({ variant, guild, user, children }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);
  const drawerId = useId();
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const width = collapsed ? COLLAPSED : EXPANDED;

  // Leaving the drawer layout (rotating a tablet, resizing a window) closes it; entering it un-collapses the sidebar.
  useEffect(() => {
    const query = window.matchMedia(DESKTOP);
    const onChange = () => {
      setOpen(false);
      if (!query.matches) {
        setCollapsed(false);
      }
    };

    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    closeButton.current?.focus();
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";

    const close = () => setOpen(false);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };
    const menu = menuButton.current;

    document.addEventListener("keydown", onKey);
    window.addEventListener("popstate", close);

    return () => {
      root.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", close);
      menu?.focus({ preventScroll: true });
    };
  }, [open]);

  /** Following any link of the drawer closes it (the page changes behind). */
  function closeOnLink(event: MouseEvent<HTMLElement>) {
    if (open && event.target instanceof Element && event.target.closest("a[href]")) {
      setOpen(false);
    }
  }

  return (
    <div className="box-border flex min-h-screen flex-wrap items-stretch gap-4 bg-bg p-4 max-lg:content-start">
      <div
        inert={open}
        className="sticky top-0 z-30 -mx-4 -mt-4 box-border flex basis-[calc(100%+2rem)] items-center gap-3 border-b border-line bg-bg/95 px-4 py-2 backdrop-blur-md lg:hidden"
      >
        <button
          ref={menuButton}
          type="button"
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls={drawerId}
          onClick={() => setOpen(true)}
          className={SQUARE_BUTTON}
        >
          <Icon name="menu" size={20} />
        </button>
        <span className="font-display text-[19px] font-bold">Sakutina</span>
      </div>

      {open ? (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 cursor-default border-0 bg-black/60 p-0 lg:hidden"
        />
      ) : null}

      <aside
        id={drawerId}
        data-collapsed={collapsed}
        aria-label="Menu"
        onClick={closeOnLink}
        className={cn(
          "group/side box-border flex flex-col gap-3.5 rounded-[20px] border border-line bg-card px-3.5 pt-[18px] pb-3.5",
          "lg:sticky lg:top-4 lg:h-[calc(100dvh-2rem)] lg:max-w-(--side-w) lg:flex-[0_0_var(--side-w)] lg:self-start lg:overflow-y-auto",
          "max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-50 max-lg:w-[min(320px,calc(100vw-48px))] max-lg:overflow-y-auto max-lg:overscroll-contain max-lg:rounded-l-none max-lg:border-l-0 max-lg:pb-[max(14px,env(safe-area-inset-bottom))]",
          "max-lg:duration-200 max-lg:ease-out motion-reduce:transition-none",
          // Visible at once when opening (so focus can move in), hidden only once it has slid out when closing.
          open
            ? "max-lg:visible max-lg:translate-x-0 max-lg:transition-[translate]"
            : "max-lg:invisible max-lg:-translate-x-full max-lg:transition-[translate,visibility]",
        )}
        style={{ "--side-w": `${width}px` } as CSSProperties}
      >
        <div className="flex items-center justify-between border-b-2 border-accent px-1 pb-3 group-data-[collapsed=true]/side:justify-center">
          <span className="font-display text-[19px] font-bold group-data-[collapsed=true]/side:hidden">Sakutina</span>
          <button
            type="button"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((value) => !value)}
            className={cn(SQUARE_BUTTON, "max-lg:hidden")}
          >
            <Icon
              name="collapse"
              size={18}
              className={cn("transition-transform duration-200 motion-reduce:transition-none", collapsed && "rotate-180")}
            />
          </button>
          <button ref={closeButton} type="button" aria-label="Close menu" onClick={() => setOpen(false)} className={cn(SQUARE_BUTTON, "lg:hidden")}>
            <Icon name="close" size={18} />
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
              className="flex min-h-10 cursor-not-allowed items-center gap-2.5 rounded-[10px] border border-line px-2.5 text-sm font-medium text-fg-soft opacity-60 group-data-[collapsed=true]/side:justify-center max-lg:min-h-11"
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

      {/* `contents`: the page stays a direct flex item of the frame; `inert` keeps focus in the open drawer. */}
      <div inert={open} className="contents">
        {children}
      </div>
    </div>
  );
}

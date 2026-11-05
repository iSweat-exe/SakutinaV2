import type { IconName } from "@/lib/icons";

/** `href` is a page of the current server, relative to `/servers/<id>/`. */
export type NavItem = Readonly<{ name: string; href: string; icon: IconName }>;
export type NavGroup = Readonly<{ label: string; items: ReadonlyArray<NavItem> }>;

export const NAV_GROUPS: ReadonlyArray<NavGroup> = [
  { label: "Overview", items: [{ name: "Dashboard", href: "dashboard", icon: "dashboard" }] },
  {
    label: "Security",
    items: [
      { name: "Anti-Raid", href: "anti-raid", icon: "shield" },
      { name: "Moderation", href: "moderation", icon: "ban" },
      { name: "Phaethon", href: "phaethon", icon: "eye" },
    ],
  },
  {
    label: "Economy",
    items: [
      { name: "Balance", href: "balance", icon: "coin" },
      { name: "Casino", href: "casino", icon: "dice" },
    ],
  },
  { label: "Community", items: [{ name: "Profiling", href: "profiling", icon: "user" }] },
  { label: "Configuration", items: [{ name: "Modules", href: "modules", icon: "cube" }] },
];

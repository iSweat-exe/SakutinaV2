import type { ReactNode } from "react";
import type { FeatureKey } from "@/lib/features";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";
import type { IconName } from "@/lib/icons";
import { Locked } from "./locked";

type CardProps = Readonly<{
  /** Padding utility, e.g. "p-[18px_20px]". */
  className?: string;
  /** Locks the whole card until this feature is wired. */
  lock?: FeatureKey;
  labelledBy?: string;
  label?: string;
  children: ReactNode;
}>;

/** The panel's surface: every section of every page is one of these. */
export function Card({ className, lock, labelledBy, label, children }: CardProps) {
  const classes = cn("flex min-w-0 flex-col rounded-2xl border border-line bg-card", className);
  const aria = { "aria-labelledby": labelledBy, "aria-label": label };

  if (lock) {
    return (
      <Locked feature={lock} as="section" className={classes} {...aria}>
        {children}
      </Locked>
    );
  }

  return (
    <section className={classes} {...aria}>
      {children}
    </section>
  );
}

type TitleProps = Readonly<{
  id?: string;
  icon?: IconName;
  /** Font size in px; sections use 20, dossier panels 17. */
  size?: 17 | 19 | 20;
  children: ReactNode;
}>;

export function CardTitle({ id, icon, size = 20, children }: TitleProps) {
  return (
    <h2
      id={id}
      className={cn(
        "m-0 flex items-center gap-2.5 font-display font-bold",
        size === 20 ? "text-xl" : size === 19 ? "text-[19px]" : "text-[17px]",
      )}
    >
      {icon ? <Icon name={icon} size={20} className="flex-none text-fg-soft" /> : null}
      {children}
    </h2>
  );
}

import type { ElementType, ReactNode } from "react";
import { FEATURES, type FeatureKey } from "@/lib/features";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

type Props = Readonly<{
  feature: FeatureKey;
  as?: ElementType;
  /** Icon-only padlock, for a lone control (a switch in a header). */
  compact?: boolean;
  className?: string;
  children: ReactNode;
  /** Inline styling hook for the wrapper (e.g. aria-labelledby on a section). */
  [key: `aria-${string}`]: string | undefined;
}>;

/**
 * A block whose data or action is not wired yet (see lib/features.ts).
 * The sample layout stays visible but dimmed, inert and out of the
 * accessibility tree, under a padlock that says what is missing.
 * Once the feature is wired the block renders as if the lock never existed.
 */
export function Locked({ feature, as: Tag = "div", compact, className, children, ...rest }: Props) {
  const entry = FEATURES[feature];

  if (entry.wired as boolean) {
    return (
      <Tag className={className} {...rest}>
        {children}
      </Tag>
    );
  }

  return (
    <Tag className={cn("relative", className)} {...rest}>
      {/* `contents` keeps the children laid out exactly as without the lock. */}
      <div inert className="contents">
        {children}
      </div>
      <div
        role="status"
        title={compact ? `Locked · ${entry.needs}` : undefined}
        className="absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] bg-bg/40 p-3 backdrop-blur-[1.5px]"
      >
        {compact ? (
          <>
            <Icon name="lock" size={16} className="text-fg-soft" />
            <span className="sr-clip">Locked · {entry.needs}</span>
          </>
        ) : (
          // Sticky: on a tall block the padlock follows the reader instead of sitting off-screen.
          <span className="sticky top-[28vh] bottom-[28vh] inline-flex max-w-full items-center gap-2 rounded-full border border-line-strong bg-raised px-3.5 py-2 text-center text-[12.5px] font-semibold text-fg-soft">
            <Icon name="lock" size={15} className="flex-none text-muted" />
            <span>
              Locked <span className="font-normal text-muted">· {entry.needs}</span>
            </span>
          </span>
        )}
      </div>
    </Tag>
  );
}

/**
 * Padlock for a line of text (a summary, a row of figures): the padlock sits
 * before the dimmed content instead of covering it.
 */
export function LockedInline({
  feature,
  className,
  children,
}: Readonly<{ feature: FeatureKey; className?: string; children: ReactNode }>) {
  const entry = FEATURES[feature];

  if (entry.wired as boolean) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={cn("flex items-center gap-2.5", className)} title={`Locked · ${entry.needs}`}>
      <Icon name="lock" size={15} className="flex-none text-muted" />
      <span className="sr-clip">Locked · {entry.needs}</span>
      <div inert className="opacity-50">
        {children}
      </div>
    </div>
  );
}

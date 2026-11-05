import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Props = Readonly<{
  /** "default": most pages. "roomy": server picker. "dense": Phaethon. */
  density?: "default" | "roomy" | "dense";
  children: ReactNode;
}>;

/** The content column next to the sidebar. */
export function PageMain({ density = "default", children }: Props) {
  return (
    <main
      className={cn(
        "box-border flex min-w-0 flex-[999_1_560px] flex-col",
        density === "default" && "gap-4 px-5 pt-6 pb-5",
        density === "roomy" && "gap-10 px-8 pt-10 pb-7",
        density === "dense" && "gap-3.5 px-4 pt-5 pb-4",
      )}
    >
      {children}
    </main>
  );
}

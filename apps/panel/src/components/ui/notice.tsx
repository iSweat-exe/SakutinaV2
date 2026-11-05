import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import type { IconName } from "@/lib/icons";

type Props = Readonly<{
  icon: IconName;
  title: string;
  children: ReactNode;
}>;

/** An alert in place of a page (or part of one) that is not built yet. Same look as the access notices. */
export function Notice({ icon, title, children }: Props) {
  return (
    <Card className="items-start gap-2 px-5 py-[18px]" label={title}>
      <div role="status" className="flex items-start gap-3">
        <Icon name={icon} size={20} className="mt-0.5 flex-none text-warning" />
        <div className="flex flex-col gap-1">
          <h2 className="m-0 font-display text-xl font-bold">{title}</h2>
          <div className="max-w-[64ch] text-sm leading-normal text-muted">{children}</div>
        </div>
      </div>
    </Card>
  );
}

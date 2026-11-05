import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";

type Props = Readonly<{ state: "denied" | "unavailable" }>;

const COPY = {
  denied: {
    title: "Your Discord account is not authorized for this server",
    body: "Signing in is not enough: the server owner must add your Discord ID to the panel's administrator list. Ask them, then reload this page.",
  },
  unavailable: {
    title: "The panel cannot read the database right now",
    body: "The database did not answer as expected. It may be paused or still starting. Reload in a minute; if it persists, check the bot and the Supabase project.",
  },
} as const;

/** Shown in place of a page's data when the database refuses or cannot answer. */
export function AccessNotice({ state }: Props) {
  const { title, body } = COPY[state];

  return (
    <Card className="items-start gap-2 px-5 py-[18px]" label={title}>
      <div role="status" className="flex items-start gap-3">
        <Icon name="lock" size={20} className="mt-0.5 flex-none text-warning" />
        <div className="flex flex-col gap-1">
          <h2 className="m-0 font-display text-xl font-bold">{title}</h2>
          <p className="m-0 max-w-[60ch] text-sm leading-normal text-muted">{body}</p>
        </div>
      </div>
    </Card>
  );
}

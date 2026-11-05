import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { getPanelUser } from "@/lib/user";

const CHIP =
  "flex items-center gap-2.5 rounded-[14px] border border-line bg-raised p-2 group-data-[collapsed=true]/side:flex-col group-data-[collapsed=true]/side:p-1";

/** Signed-in user at the bottom of the sidebar, with a POST sign-out. */
export async function UserChip() {
  const user = await getPanelUser();

  if (!user) {
    return null;
  }

  return (
    <div className={CHIP}>
      <Avatar src={user.avatarUrl} size={36} />
      <div className="flex min-w-0 flex-1 flex-col group-data-[collapsed=true]/side:hidden">
        <span className="truncate text-[13.5px] font-semibold">{user.name}</span>
        <span className="truncate text-xs text-muted">{user.handle}</span>
      </div>
      <form action="/auth/signout" method="post" className="flex-none">
        <button
          type="submit"
          aria-label="Log out"
          className="flex size-11 cursor-pointer items-center justify-center rounded-full border border-line-strong bg-transparent text-fg-soft hover:border-accent"
        >
          <Icon name="logout" size={18} />
        </button>
      </form>
    </div>
  );
}

export function UserChipFallback() {
  return (
    <div className={CHIP} aria-hidden="true">
      <Avatar size={36} />
      <div className="flex min-w-0 flex-1 flex-col gap-1 group-data-[collapsed=true]/side:hidden">
        <span className="h-3.5 w-20 rounded bg-selected" />
        <span className="h-3 w-14 rounded bg-selected" />
      </div>
      <span className="size-11 flex-none rounded-full border border-line-strong" />
    </div>
  );
}

import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";

type RowData = Readonly<{ name: string; initial: string; meta: string; banner?: string; iconUrl?: string | null }>;

const ROW =
  "group/row relative box-border flex min-h-[68px] items-center gap-3.5 overflow-hidden rounded-[14px] border border-line bg-card py-2.5 pr-[18px] pl-3.5 transition-colors hover:border-[#4a4a50] focus-visible:border-[#4a4a50]";

function Banner({ gradient }: Readonly<{ gradient?: string }>) {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 opacity-0 transition-opacity duration-200 [clip-path:polygon(34%_0,calc(100%-72px)_0,calc(100%-104px)_100%,26%_100%)] group-hover/row:opacity-60 group-focus-visible/row:opacity-60"
      style={{ background: gradient }}
    />
  );
}

/** Round server picture, or the first letter when the server has none. */
function Avatar({ server, className }: Readonly<{ server: RowData; className: string }>) {
  return (
    <span
      aria-hidden="true"
      className={`${className} relative flex size-[42px] flex-none items-center justify-center overflow-hidden rounded-full text-base font-bold`}
    >
      {server.iconUrl ? (
        <Image src={server.iconUrl} alt="" width={42} height={42} unoptimized className="size-full object-cover" />
      ) : (
        server.initial
      )}
    </span>
  );
}

function Identity({ server }: Readonly<{ server: RowData }>) {
  return (
    <>
      <Avatar server={server} className="border border-[#55555a] bg-selected" />
      <div className="relative flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-base font-semibold">{server.name}</span>
        <span className="text-[12.5px] text-muted">{server.meta}</span>
      </div>
    </>
  );
}

/** A server the bot is in: opens its dashboard. */
export function ServerLink({ server, href }: Readonly<{ server: RowData; href: string }>) {
  return (
    <Link href={href} className={`${ROW} text-fg no-underline`}>
      <Banner gradient={server.banner} />
      <Identity server={server} />
      <span aria-hidden="true" className="relative flex size-7 flex-none items-center justify-center text-muted transition-colors group-hover/row:text-accent group-focus-visible/row:text-accent">
        <Icon name="arrowUpRight" size={20} strokeWidth={2} />
      </span>
    </Link>
  );
}

/** A server you administer but the bot has not joined. Without an invite link there is no button. */
export function ServerInvite({ server, href }: Readonly<{ server: RowData; href?: string | null }>) {
  return (
    <div className={ROW}>
      <Banner gradient={server.banner} />
      <Identity server={server} />
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="relative box-border flex h-10 flex-none items-center gap-2 rounded-[10px] border border-[#4a4a50] bg-card px-3.5 pl-4 text-[13px] font-semibold text-fg no-underline transition-colors hover:border-accent hover:bg-accent hover:text-on-accent"
        >
          <span>Add Bot</span>
          <Icon name="plus" size={14} strokeWidth={2.4} />
        </a>
      ) : null}
    </div>
  );
}

/** A server you cannot manage. */
export function ServerDisabled({ server }: Readonly<{ server: RowData }>) {
  return (
    <div
      aria-disabled="true"
      className="box-border flex min-h-[68px] items-center gap-3.5 rounded-[14px] border border-[#28282b] py-2.5 pr-[18px] pl-3.5 text-faint [background:repeating-linear-gradient(135deg,#131314_0_4px,#171718_4px_8px)]"
    >
      <Avatar server={server} className="border border-line-strong bg-[#1a1a1c] opacity-60 grayscale" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-base font-semibold text-[#b4b4bb]">{server.name}</span>
        <span className="text-[12.5px]">{server.meta}</span>
      </div>
    </div>
  );
}

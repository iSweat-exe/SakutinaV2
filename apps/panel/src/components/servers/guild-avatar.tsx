import Image from "next/image";
import { cn } from "@/lib/cn";

type Props = Readonly<{
  name: string;
  /** Discord CDN url of the server picture; without it, the first letter of the name. */
  iconUrl: string | null | undefined;
  size: number;
  className?: string;
}>;

/** Round server picture, or the server's initial when it has none. Decorative: the name is always written next to it. */
export function GuildAvatar({ name, iconUrl, size, className }: Props) {
  return (
    <span
      aria-hidden="true"
      className={cn("relative flex flex-none items-center justify-center overflow-hidden rounded-full font-bold", className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {iconUrl ? (
        <Image src={iconUrl} alt="" width={size} height={size} unoptimized className="size-full object-cover" />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </span>
  );
}

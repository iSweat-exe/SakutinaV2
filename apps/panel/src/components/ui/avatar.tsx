import Image from "next/image";
import { cn } from "@/lib/cn";

type Props = Readonly<{
  src?: string | null;
  size: number;
  large?: boolean;
  className?: string;
}>;

/** Discord avatar when known, striped placeholder otherwise. */
export function Avatar({ src, size, large, className }: Props) {
  if (src) {
    return (
      <Image
        src={src}
        alt=""
        width={size}
        height={size}
        unoptimized
        className={cn("flex-none rounded-full border border-[#55555a] object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn("avatar-ph", large && "avatar-ph-lg", className)}
      style={{ width: size, height: size }}
    />
  );
}

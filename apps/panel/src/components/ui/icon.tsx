import { ICONS, type IconName } from "@/lib/icons";

type Props = Readonly<{
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}>;

/** Decorative stroke icon; color comes from `currentColor`. */
export function Icon({ name, size = 17, strokeWidth = 1.8, className }: Props) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

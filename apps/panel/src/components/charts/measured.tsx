"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Renders `children(width)` once the box's width in CSS pixels is known, and again whenever it changes, so a
 * chart can be drawn at its real size (text stays at its real font size on a phone). Hidden (width 0), it
 * renders nothing; before the first measure it holds `minHeight` so the page does not jump.
 */
export function Measured({
  className,
  minHeight,
  children,
}: Readonly<{ className?: string; minHeight: number; children: (width: number) => ReactNode }>) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry?.contentRect.width ?? 0)));
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={className} style={width > 0 ? undefined : { minHeight }}>
      {width > 0 ? children(width) : null}
    </div>
  );
}

/** An id usable inside `url(#…)`: React's ids contain characters CSS would need escaped. */
export function svgId(reactId: string, name: string): string {
  return `${name}-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

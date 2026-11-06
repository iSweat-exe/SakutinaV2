"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

/**
 * Which point of a line chart is hovered, touched or selected with the keyboard.
 *
 * `left` / `right` / `viewWidth` are the chart's coordinates in its SVG viewBox: the pointer is
 * converted from screen pixels to those, then snapped to the nearest of the `count` points.
 * Spread `bind` on the `<svg>` and attach `svgRef` to it.
 */
export function useChartHover(count: number, left: number, right: number, viewWidth: number) {
  const [active, setActive] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const clamp = (index: number) => Math.min(count - 1, Math.max(0, index));

  function indexAt(clientX: number): number | null {
    const box = svgRef.current?.getBoundingClientRect();

    if (!box || box.width === 0 || count < 1) {
      return null;
    }

    const x = ((clientX - box.left) / box.width) * viewWidth;

    return count === 1 ? 0 : clamp(Math.round(((x - left) / (right - left)) * (count - 1)));
  }

  const bind = {
    tabIndex: 0,
    onPointerMove: (event: PointerEvent<SVGSVGElement>) => setActive(indexAt(event.clientX)),
    onPointerDown: (event: PointerEvent<SVGSVGElement>) => setActive(indexAt(event.clientX)),
    // A mouse leaving the chart clears the readout; a lifted finger keeps it until the chart loses focus.
    onPointerLeave: (event: PointerEvent<SVGSVGElement>) => {
      if (event.pointerType === "mouse") {
        setActive(null);
      }
    },
    onFocus: () => setActive((current) => current ?? count - 1),
    onBlur: () => setActive(null),
    onKeyDown: (event: KeyboardEvent<SVGSVGElement>) => {
      const step = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;

      if (step !== 0) {
        event.preventDefault();
        setActive((current) => clamp((current ?? count - 1) + step));
      } else if (event.key === "Home") {
        event.preventDefault();
        setActive(0);
      } else if (event.key === "End") {
        event.preventDefault();
        setActive(count - 1);
      } else if (event.key === "Escape") {
        setActive(null);
      }
    },
  };

  return { active, svgRef, bind };
}

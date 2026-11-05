"use client";

import { useRef, type CSSProperties, type ReactNode } from "react";

const LAYER = (depth: number): CSSProperties => ({
  transform: `translate3d(calc(var(--mx, 0) * ${-depth}px), calc(var(--my, 0) * ${-depth}px), 0)`,
});

function Layer({ depth, children }: Readonly<{ depth: number; children: ReactNode }>) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -inset-20 transition-transform duration-[350ms] ease-out will-change-transform motion-reduce:transition-none"
      style={LAYER(depth)}
    >
      <svg viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" fill="none">
        {children}
      </svg>
    </div>
  );
}

/**
 * Login backdrop: three layers of accent lines that drift against the cursor.
 * The cursor position is written to CSS variables, so moving the mouse never
 * re-renders React.
 */
export function LoginScene({ children }: Readonly<{ children: ReactNode }>) {
  const ref = useRef<HTMLDivElement>(null);

  function move(event: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return;
    }
    el.style.setProperty("--mx", String(((event.clientX - rect.left) / rect.width) * 2 - 1));
    el.style.setProperty("--my", String(((event.clientY - rect.top) / rect.height) * 2 - 1));
  }

  function reset() {
    ref.current?.style.setProperty("--mx", "0");
    ref.current?.style.setProperty("--my", "0");
  }

  return (
    <div
      ref={ref}
      onMouseMove={move}
      onMouseLeave={reset}
      className="relative box-border flex min-h-screen flex-col items-center justify-center gap-5 overflow-hidden bg-bg px-4 py-12"
    >
      <Layer depth={10}>
        <path d="M170 80 C 290 270, 300 380, 270 470 S 180 640, 225 780" className="stroke-accent" strokeOpacity="0.22" strokeWidth="1.5" />
        <path d="M182 76 C 304 268, 314 382, 284 474 S 194 644, 240 784" className="stroke-accent" strokeOpacity="0.12" strokeWidth="1.5" />
        <path d="M980 40 C 1110 150, 1030 300, 1120 430 S 1240 560, 1200 780" className="stroke-accent" strokeOpacity="0.22" strokeWidth="1.5" />
        <path d="M992 44 C 1122 154, 1044 304, 1134 434 S 1254 564, 1214 784" className="stroke-accent" strokeOpacity="0.12" strokeWidth="1.5" />
      </Layer>
      <Layer depth={24}>
        <path d="M120 120 C 250 300, 260 400, 230 490 S 130 660, 175 800" className="stroke-accent" strokeOpacity="0.38" strokeWidth="2" />
        <path d="M1010 20 C 1150 140, 1070 320, 1160 450 S 1270 590, 1230 800" className="stroke-accent" strokeOpacity="0.38" strokeWidth="2" />
      </Layer>
      <Layer depth={46}>
        <path d="M-60 270 L 300 50" className="stroke-accent" strokeOpacity="0.85" strokeWidth="2.5" />
        <path d="M1040 780 L 1340 420" className="stroke-accent" strokeOpacity="0.85" strokeWidth="2.5" />
      </Layer>
      {children}
    </div>
  );
}

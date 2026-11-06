"use client";

import { useEffect, useRef, useState } from "react";

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));

/**
 * A number that counts from 0 to `value` once it scrolls into view. The server
 * renders the final value (readable without JavaScript); screen readers always
 * get the final value, never the moving one.
 */
export function CountUp({
  value,
  format,
  duration = 1800,
  delay = 0,
}: Readonly<{ value: number; format: (n: number) => string; duration?: number; delay?: number }>) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let raf = 0;
    let timer = 0;
    // Start from 0 until the number is seen.
    setShown(0);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        timer = window.setTimeout(() => {
          const start = performance.now();
          const tick = (now: number) => {
            const t = Math.min(1, (now - start) / duration);
            setShown(value * easeOutExpo(t));
            if (t < 1) raf = requestAnimationFrame(tick);
          };
          raf = requestAnimationFrame(tick);
        }, delay);
      },
      { threshold: 0.6 },
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [value, duration, delay]);

  return (
    <span className="lp-count">
      <span className="lp-sr">{format(value)}</span>
      <span ref={ref} aria-hidden="true">
        {format(shown)}
      </span>
    </span>
  );
}

"use client";

import { useEffect, type RefObject } from "react";

/** Elements that animate in: text blocks, cards (and the charts inside them), split titles. */
const REVEAL = ".lp-rv, [data-reveal]";

/**
 * Every effect of the landing page that follows the visitor, wired once on its root:
 * - reveals: an element gets `data-shown` the first time it enters the screen, which
 *   starts its CSS animations (charts draw, bars grow, words rise);
 * - scroll: progress bar, hero parallax, and a marquee that speeds up, reverses
 *   and leans with the scroll;
 * - pointer: magnetic buttons and a light that follows the cursor on cards.
 * With reduced motion everything is shown at once and nothing follows the pointer.
 */
export function useLandingMotion(rootRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    root.dataset.motion = reduced ? "off" : "on";

    if (reduced) {
      for (const el of root.querySelectorAll<HTMLElement>(REVEAL)) el.dataset.shown = "true";
      return;
    }

    /* ---------- Reveals ---------- */
    const reveal = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).dataset.shown = "true";
            reveal.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.18, rootMargin: "0px 0px -8% 0px" },
    );
    for (const el of root.querySelectorAll(REVEAL)) reveal.observe(el);

    /* ---------- Scroll ---------- */
    const hero = root.querySelector<HTMLElement>(".lp-herobg");
    const marquee = root.querySelector<HTMLElement>(".lp-marq");
    const marqueeAnim = marquee?.getAnimations()[0];
    let lastY = window.scrollY;
    let velocity = 0;
    let raf = 0;

    const paint = () => {
      raf = 0;
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      root.style.setProperty("--lp-progress", String(max > 0 ? y / max : 0));
      if (hero) {
        root.style.setProperty("--lp-hero", String(Math.min(1, Math.max(0, y / hero.offsetHeight))));
      }

      // The marquee follows the scroll: faster, backwards when scrolling up, then settles.
      velocity = velocity * 0.9 + (y - lastY) * 0.1;
      lastY = y;
      const v = Math.max(-1, Math.min(1, velocity / 40));
      root.style.setProperty("--lp-skew", `${(-v * 8).toFixed(2)}deg`);
      if (marqueeAnim) marqueeAnim.playbackRate = Math.abs(v) < 0.02 ? 1 : Math.sign(v) * (1 + Math.abs(v) * 5);
      if (Math.abs(velocity) > 0.05) raf = requestAnimationFrame(paint);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(paint);
    };
    paint();
    window.addEventListener("scroll", onScroll, { passive: true });

    /* ---------- Pointer ---------- */
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const onMove = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const card = target?.closest<HTMLElement>(".lp-card");
      if (card) {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--px", `${event.clientX - r.left}px`);
        card.style.setProperty("--py", `${event.clientY - r.top}px`);
      }
      const magnet = target?.closest<HTMLElement>(".lp-magnet");
      if (magnet) {
        const r = magnet.getBoundingClientRect();
        magnet.style.setProperty("--mx", `${((event.clientX - r.left) / r.width - 0.5) * 14}px`);
        magnet.style.setProperty("--my", `${((event.clientY - r.top) / r.height - 0.5) * 10}px`);
      }
    };
    const onOut = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const related = event.relatedTarget instanceof Node ? event.relatedTarget : null;
      const card = target?.closest<HTMLElement>(".lp-card");
      if (card && !card.contains(related)) {
        card.style.removeProperty("--px");
        card.style.removeProperty("--py");
      }
      const magnet = target?.closest<HTMLElement>(".lp-magnet");
      if (magnet && !magnet.contains(related)) {
        magnet.style.removeProperty("--mx");
        magnet.style.removeProperty("--my");
      }
    };
    if (finePointer) {
      root.addEventListener("pointermove", onMove);
      root.addEventListener("pointerout", onOut);
    }

    return () => {
      reveal.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerout", onOut);
    };
  }, [rootRef]);
}

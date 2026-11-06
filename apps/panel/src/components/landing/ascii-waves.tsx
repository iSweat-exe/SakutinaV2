"use client";

import { useEffect, useRef, type ReactNode } from "react";

const COLS = 200;
const ROWS = 56;
const RAMP = [" ", ".", ":", "-", "~", "=", "+"];

const baseAt = (x: number, y: number) => 0.22 * Math.sin(x * 0.07 + y * 0.3) + 0.2 * Math.sin(x * 0.03 - y * 0.19);
const toChar = (v: number) =>
  RAMP[Math.max(0, Math.min(RAMP.length - 1, Math.floor(((v + 0.9) / 1.8) * RAMP.length)))];

/** The still sea, rendered on the server: the simulation only starts on the first movement. */
const BASE = Array.from({ length: ROWS }, (_, y) =>
  Array.from({ length: COLS }, (_, x) => toChar(baseAt(x, y))).join(""),
).join("\n");

type Field = { h: Float32Array; p: Float32Array };
type Drop = { x: number; y: number; t0: number };
type Sim = { A: Field; B: Field; running: boolean; still: number; last: { x: number; y: number } | null; t: number; drops: Drop[]; raf: number };

const field = (): Field => ({ h: new Float32Array(COLS * ROWS), p: new Float32Array(COLS * ROWS) });

/** One step of the wave equation on a field; returns its highest amplitude. */
function stepField(F: Field, damp: number): number {
  const { h, p } = F;
  let peak = 0;
  for (let y = 1; y < ROWS - 1; y++) {
    for (let x = 1; x < COLS - 1; x++) {
      const i = y * COLS + x;
      const c = h[i];
      const n = (2 * c - p[i] + 0.3 * (h[i - 1] + h[i + 1] - 2 * c) + 0.075 * (h[i - COLS] + h[i + COLS] - 2 * c)) * damp;
      p[i] = n;
      const a = n < 0 ? -n : n;
      if (a > peak) peak = a;
    }
  }
  F.h = p;
  F.p = h;
  return peak;
}

function splash(F: Field, cx: number, cy: number, amp: number, rx: number, ry: number) {
  const kx = Math.ceil(rx * 2);
  const ky = Math.ceil(ry * 2);
  for (let dy = -ky; dy <= ky; dy++) {
    for (let dx = -kx; dx <= kx; dx++) {
      const x = Math.round(cx) + dx;
      const y = Math.round(cy) + dy;
      if (x < 1 || y < 1 || x >= COLS - 1 || y >= ROWS - 1) continue;
      F.h[y * COLS + x] += amp * Math.exp(-((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry)));
    }
  }
}

/**
 * A sea of ASCII characters behind the hero. Moving the mouse leaves a grey wake;
 * a click drops a stone whose rings take the accent colour. Two wave fields run
 * outside React (text written straight to the DOM), so re-renders never happen.
 */
export function AsciiWaves({ children }: Readonly<{ children: ReactNode }>) {
  const boxRef = useRef<HTMLDivElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const baseRef = useRef<HTMLSpanElement>(null);
  const liveRef = useRef<HTMLSpanElement>(null);
  const accRef = useRef<HTMLSpanElement>(null);
  const simRef = useRef<Sim | null>(null);

  useEffect(() => () => {
    if (simRef.current) cancelAnimationFrame(simRef.current.raf);
  }, []);

  function sim(): Sim {
    simRef.current ??= { A: field(), B: field(), running: false, still: 0, last: null, t: 0, drops: [], raf: 0 };
    return simRef.current;
  }

  function frame() {
    const s = sim();
    const live = liveRef.current;
    const acc = accRef.current;
    if (!live || !acc) {
      s.running = false;
      return;
    }
    const pa = stepField(s.A, 0.988);
    const pb = stepField(s.B, 0.99);
    s.t += 1;
    const a = s.A.h;
    const b = s.B.h;
    const plain: string[] = [];
    const tinted: string[] = [];
    for (let y = 0; y < ROWS; y++) {
      let l1 = "";
      let l2 = "";
      for (let x = 0; x < COLS; x++) {
        const i = y * COLS + x;
        const ch = toChar(baseAt(x, y) + (a[i] + b[i]) * 0.35);
        // Only the characters on a moving ring take the accent colour.
        let front = false;
        if (b[i] > 0.05 || b[i] < -0.05) {
          for (const d of s.drops) {
            const dx = x - d.x;
            const dy = (y - d.y) * 2;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const radius = 3 + 0.5 * (s.t - d.t0);
            if (dist > radius - 5 && dist < radius + 2) {
              front = true;
              break;
            }
          }
        }
        if (front) {
          l1 += " ";
          l2 += ch;
        } else {
          l1 += ch;
          l2 += " ";
        }
      }
      plain.push(l1);
      tinted.push(l2);
    }
    live.textContent = plain.join("\n");
    acc.textContent = tinted.join("\n");
    s.still = pa < 0.02 && pb < 0.02 ? s.still + 1 : 0;
    s.drops = s.drops.filter((d) => 3 + 0.5 * (s.t - d.t0) < 260);
    if (s.still > 30) {
      s.running = false;
      s.drops = [];
      return;
    }
    s.raf = requestAnimationFrame(frame);
  }

  function run() {
    const s = sim();
    if (s.running) return;
    s.running = true;
    s.still = 0;
    if (baseRef.current) baseRef.current.style.visibility = "hidden";
    frame();
  }

  /** Mouse position in character cells, or null when motion is reduced. */
  function cell(event: React.MouseEvent<HTMLDivElement>) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return null;
    const box = boxRef.current;
    const pre = preRef.current;
    if (!box || !pre) return null;
    const rect = box.getBoundingClientRect();
    const fs = parseFloat(window.getComputedStyle(pre).fontSize) || 16;
    return { x: (event.clientX - rect.left) / (fs * 0.6), y: (event.clientY - rect.top) / (fs * 1.2) };
  }

  function move(event: React.MouseEvent<HTMLDivElement>) {
    const g = cell(event);
    if (!g) return;
    const s = sim();
    const last = s.last;
    s.last = g;
    if (!last) return;
    const dist = Math.sqrt((g.x - last.x) ** 2 + ((g.y - last.y) * 2) ** 2);
    if (dist < 0.3) return;
    const steps = Math.max(1, Math.ceil(dist / 1.5));
    const amp = Math.min(2.4, 0.5 + dist * 0.22);
    for (let k = 1; k <= steps; k++) {
      splash(s.A, last.x + ((g.x - last.x) * k) / steps, last.y + ((g.y - last.y) * k) / steps, amp / Math.sqrt(steps), 2.4, 1.3);
    }
    run();
  }

  /** A drop falling in: a deep crater, a bounce, then rings that spread out. */
  function drop(event: React.MouseEvent<HTMLDivElement>) {
    if (event.target instanceof Element && event.target.closest("a, button")) return;
    const g = cell(event);
    if (!g) return;
    const s = sim();
    splash(s.B, g.x, g.y, -7, 3.2, 1.6);
    splash(s.B, g.x, g.y, 3.5, 6, 3);
    s.drops.push({ x: g.x, y: g.y, t0: s.t });
    run();
  }

  function leave() {
    if (simRef.current) simRef.current.last = null;
  }

  return (
    // Decorative only: the waves react to the pointer, nothing here is a control.
    <div ref={boxRef} className="lp-herobg" onMouseMove={move} onMouseDown={drop} onMouseLeave={leave}>
      <pre ref={preRef} className="lp-ascii" aria-hidden="true">
        <span ref={baseRef} className="lp-wbase">
          {BASE}
        </span>
        <span ref={liveRef} className="lp-wlive" />
        <span ref={accRef} className="lp-wacc" />
      </pre>
      {children}
    </div>
  );
}

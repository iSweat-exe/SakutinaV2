"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { SampleProfile } from "@/lib/sample-profiles";
import { AsciiWaves } from "./ascii-waves";
import {
  COPY,
  FACTOR_NAMES,
  GAME_NAMES_FR,
  LANG_NAMES,
  LANGS,
  MARQUEE_WORDS,
  MODULE_NAMES,
  MONTHS_FR,
  ROLE_NAMES,
  type Copy,
  type Lang,
} from "./copy";
import { CountUp } from "./count-up";
import {
  avatarUri,
  DASH_LINE,
  DASH_LINE_2,
  DASH_NAV,
  DASH_ROWS,
  FACTORS,
  FLAGS,
  GAMES,
  GAUGE_LENGTH,
  LINKED_NODES,
  MARKET,
  MEMBERS,
  MODULE_ICONS,
  MODULE_SWITCHES,
  ORBIT_INNER,
  ORBIT_OUTER,
  RAID,
  RISK_SCORE,
} from "./sample";
import mascot from "./sakutina.webp";
import { SplitWords } from "./split-words";
import { useLandingMotion } from "./use-landing-motion";
import "./landing.css";

const LANG_KEY = "sakutina.landing.lang";

/** CSS custom properties read by the animations (stagger index, delays). */
type Vars = CSSProperties & Record<`--${string}`, string | number>;

const ARROW = (
  <svg className="lp-arr" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

function Flag({ lang }: Readonly<{ lang: Lang }>) {
  return (
    <svg className="lp-flag" aria-hidden="true" width="26" height="17" viewBox="0 0 60 40" preserveAspectRatio="none">
      {FLAGS[lang].map((s, i) => (
        <path key={i} d={s.d} fill={s.fill} stroke={s.stroke} strokeWidth={s.width} />
      ))}
    </svg>
  );
}

function Icon({ d, size, stroke, width = 1.9 }: Readonly<{ d: string; size: number; stroke: string; width?: number }>) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

/** A primary button that leans toward the cursor. */
function Magnetic({ children }: Readonly<{ children: ReactNode }>) {
  return <span className="lp-magnet">{children}</span>;
}

const formatNumber = (n: number, t: Copy) => Math.round(n).toLocaleString("en-US").replace(/,/g, t.sep);

function LanguagePicker({ lang, onPick, t }: Readonly<{ lang: Lang; onPick: (lang: Lang) => void; t: Copy }>) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !boxRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <button
        type="button"
        className="lp-langbtn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${t.langAria}: ${LANG_NAMES[lang]}`}
        onClick={() => setOpen(!open)}
      >
        <Flag lang={lang} />
        <span className="lp-hide-sm">{LANG_NAMES[lang]}</span>
        <svg className="lp-chev" aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a6a6ad" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: `rotate(${open ? 180 : 0}deg)` }}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul role="listbox" aria-label={t.langAria} className="lp-langlist">
          {LANGS.map((code) => (
            <li key={code} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={code === lang}
                className="lp-langopt"
                onClick={() => {
                  onPick(code);
                  setOpen(false);
                }}
              >
                <Flag lang={code} />
                <span style={{ flex: 1 }}>{LANG_NAMES[code]}</span>
                {code === lang && <Icon d="m5 12.5 4.5 4.5L19 7.5" size={16} stroke="var(--acc)" width={2.2} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ModuleSwitches({ lang }: Readonly<{ lang: Lang }>) {
  const [on, setOn] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(MODULE_SWITCHES.map(([id, , initial]) => [id, initial])),
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))", gap: 12 }}>
      {MODULE_SWITCHES.map(([id, key], i) => (
        <div key={id} className="lp-card lp-mod lp-rv" data-on={on[id]} style={{ "--d": i } as Vars}>
          <span id={`lp-mod-${id}`} style={{ fontSize: 15.5, fontWeight: 600 }}>
            {MODULE_NAMES[lang][key]}
          </span>
          <button
            type="button"
            className="lp-sw"
            role="switch"
            aria-checked={on[id]}
            aria-labelledby={`lp-mod-${id}`}
            onClick={() => setOn((prev) => ({ ...prev, [id]: !prev[id] }))}
          >
            <span className="lp-track">
              <span className="lp-knob" />
            </span>
          </button>
        </div>
      ))}
    </div>
  );
}

/** A section title whose words rise one after the other when it scrolls into view. */
function Title({ id, text, className = "lp-h2", style }: Readonly<{ id?: string; text: string; className?: string; style?: CSSProperties }>) {
  return (
    <h2 id={id} className={`lp-disp ${className}`} data-reveal="" style={style}>
      <SplitWords text={text} />
    </h2>
  );
}

/**
 * The public landing page of Sakutina, in English or French. Every number on it
 * is sample data (see ./sample.ts); the members of the community section are
 * made-up profiles from randomuser.me (`profiles`), or drawn avatars when the
 * API could not be reached. `inviteHref` adds the bot to a server; `loginHref`
 * opens the panel.
 */
export function Landing({
  inviteHref,
  loginHref,
  profiles,
}: Readonly<{ inviteHref: string; loginHref: string; profiles: readonly SampleProfile[] }>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [lang, setLang] = useState<Lang>("en");
  const t = COPY[lang];
  const nm = MODULE_NAMES[lang];

  useLandingMotion(rootRef);

  // The server renders English; the browser then switches to the remembered or preferred language.
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(LANG_KEY);
    } catch {
      // Storage blocked: fall back to the browser's language.
    }
    const preferred = stored === "en" || stored === "fr" ? stored : navigator.language.toLowerCase().startsWith("fr") ? "fr" : "en";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the language is only known in the browser.
    setLang(preferred);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  function pick(next: Lang) {
    setLang(next);
    try {
      window.localStorage.setItem(LANG_KEY, next);
    } catch {
      // Not remembered, still applied.
    }
  }

  const int = (n: number) => formatNumber(n, t);
  const percent = (n: number) => `${Math.round(n)}%`;
  const gameName = (name: string) => (lang === "fr" ? (GAME_NAMES_FR[name] ?? name) : name);
  const joined = (date: string) => (lang === "fr" ? date.replace(/^\w+/, (m) => MONTHS_FR[m] ?? m) : date);
  const marquee = [...MARQUEE_WORDS, ...MARQUEE_WORDS];
  const members = MEMBERS.map((m, i) => ({
    ...m,
    name: profiles[i]?.username ?? m.name,
    photo: profiles[i]?.avatar ?? null,
  }));

  return (
    <div className="lp" ref={rootRef}>
      <div className="lp-grain" aria-hidden="true" />
      <div className="lp-progress" aria-hidden="true" />

      <header className="lp-wrap lp-header">
        <a href="#top" aria-label={t.homeAria} className="lp-brand">
          <span aria-hidden="true" className="lp-pp-frame" style={{ width: 38, height: 38 }}>
            <Image className="lp-pp" src={mascot} alt="" width={38} height={38} style={{ objectPosition: "50% 25%" }} />
          </span>
          <span className="lp-disp lp-hide-xs" style={{ fontSize: 24, letterSpacing: "-0.02em" }}>
            Sakutina
          </span>
        </a>
        <nav className="lp-navlinks" aria-label={t.sectionsAria}>
          <a className="lp-navlink" href="#security">{t.navSec}</a>
          <a className="lp-navlink" href="#phaethon">{t.navPh}</a>
          <a className="lp-navlink" href="#economy">{t.navEco}</a>
          <a className="lp-navlink" href="#community">{t.navCom}</a>
        </nav>
        <div className="lp-actions">
          <LanguagePicker lang={lang} onPick={pick} t={t} />
          <a className="lp-btn lp-btn-g lp-btn-sm lp-hide-sm" href={loginHref}>
            {t.login}
          </a>
          <a className="lp-btn lp-btn-p lp-btn-sm" href={inviteHref} style={{ padding: "0 22px" }}>
            {t.add}
          </a>
        </div>
      </header>

      <main id="top">
        {/* HERO */}
        <AsciiWaves>
          <section className="lp-wrap lp-hero" aria-labelledby="hero-t">
            <div style={{ display: "flex", flexDirection: "column", gap: 36, minWidth: 0 }}>
              <span className="lp-eyebrow lp-fade" style={{ animationDelay: "0s" }}>
                <span aria-hidden="true" className="lp-pulse" />
                {t.eyebrow}
              </span>
              <h1 id="hero-t" className="lp-disp lp-h1">
                <span className="lp-line">
                  <span>{t.h1a}</span>
                </span>
                <span className="lp-line">
                  <span style={{ color: "var(--acc)" }}>{t.h1b}</span>
                </span>
              </h1>
              <p className="lp-lead lp-fade">{t.heroLead}</p>
              <div className="lp-fade" style={{ display: "flex", flexWrap: "wrap", gap: 12, animationDelay: ".6s" }}>
                <Magnetic>
                  <a className="lp-btn lp-btn-p" href={inviteHref}>
                    {t.add} {ARROW}
                  </a>
                </Magnetic>
                <a className="lp-btn lp-btn-g" href="#dashboard">
                  {t.seeDash}
                </a>
              </div>
            </div>

            <div className="lp-orbit lp-fade" aria-label={t.orbitAria} role="img" style={{ animationDelay: ".3s" }}>
              <div className="lp-ring" style={{ inset: "20%" }} />
              <div className="lp-ring" style={{ inset: "3%" }} />
              <div className="lp-spin">
                {ORBIT_INNER.map((s) => (
                  <div key={s.key} className="lp-chip" style={{ left: `${s.x}%`, top: `${s.y}%` }}>
                    <span className="lp-chip-in">
                      <Icon d={MODULE_ICONS[s.key]} size={16} stroke="var(--acc)" />
                      {nm[s.key]}
                    </span>
                  </div>
                ))}
              </div>
              <div className="lp-spin lp-spin-r">
                {ORBIT_OUTER.map((s) => (
                  <div key={s.key} className="lp-chip" style={{ left: `${s.x}%`, top: `${s.y}%` }}>
                    <span className="lp-chip-in">
                      <Icon d={MODULE_ICONS[s.key]} size={16} stroke="#c4c4ca" />
                      {nm[s.key]}
                    </span>
                  </div>
                ))}
              </div>
              <div className="lp-core">
                <span className="lp-core-ring" />
                <Image className="lp-pp" src={mascot} alt={t.ppAlt} sizes="(max-width: 1100px) 34vw, 250px" priority />
              </div>
            </div>
          </section>
        </AsciiWaves>

        {/* MARQUEE */}
        <div aria-hidden="true" className="lp-marq-box">
          <div className="lp-marq">
            {marquee.map((word, i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center" }}>
                <span className={`lp-marq-w${i % 2 ? " lp-outline" : ""}`}>{word}</span>
                <svg className="lp-star" width="56" height="56" viewBox="0 0 24 24" fill="var(--acc)" style={{ flex: "none" }}>
                  <path d="M12 2l1.9 6.6L20.5 6l-4 5.4L23 12l-6.5 1.6 4 5.4-6.6-2.6L12 22l-1.9-5.6L3.5 19l4-5.4L1 12l6.5-.6-4-5.4 6.6 2.6z" />
                </svg>
              </span>
            ))}
          </div>
        </div>

        {/* 01 SECURITY */}
        <section id="security" className="lp-sec" aria-labelledby="sec-t">
          <div className="lp-wrap lp-split">
            <div className="lp-sticky lp-stack">
              <span className="lp-idx">{t.s1idx}</span>
              <Title id="sec-t" text={t.s1h} />
              <p className="lp-lead lp-rv">{t.s1p}</p>
            </div>
            <div className="lp-col">
              <div className="lp-card lp-rv" style={{ padding: "clamp(18px, 2vw, 32px)", display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "8px 20px", alignItems: "baseline" }}>
                  <span className="lp-title" style={{ fontSize: 22 }}>{t.joinsPm}</span>
                  <span className="lp-muted" style={{ fontSize: 14 }}>{t.joinsRange}</span>
                </div>
                <svg role="img" aria-label={t.raidAria} viewBox="0 0 800 270" width="100%" style={{ display: "block", height: "auto" }}>
                  {RAID.grid.map((g) => (
                    <g key={g.label}>
                      <line className="lp-gx" x1="40" x2="790" y1={g.y} y2={g.y} stroke="#2e2e31" />
                      <text x="30" y={g.ty} textAnchor="end" fontSize="12" fill="#a6a6ad" fontFamily="var(--font-sans)">{g.label}</text>
                    </g>
                  ))}
                  <g className="lp-op" style={{ "--dl": "1.15s" } as Vars}>
                    <rect x={RAID.bandX} y="26" width={RAID.bandW} height="194" fill="#fbbf24" fillOpacity=".12" stroke="#fbbf24" strokeOpacity=".55" strokeDasharray="3 3" />
                    <text x={RAID.bandCx} y="18" textAnchor="middle" fontSize="13" fontWeight="600" fill="#fbbf24" fontFamily="var(--font-sans)">{t.suspected}</text>
                  </g>
                  <path className="lp-op" style={{ "--dl": ".9s" } as Vars} d={RAID.area} fill="var(--acc)" fillOpacity=".12" />
                  <path className="lp-draw" style={{ "--dl": ".15s" } as Vars} pathLength={1} d={RAID.line} fill="none" stroke="var(--acc)" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
                  <g className="lp-pop" style={{ "--dl": "1.45s" } as Vars}>
                    <line x1={RAID.lockX} x2={RAID.lockX} y1="26" y2="220" stroke="#ff8a80" strokeWidth="1.5" />
                    <rect x={RAID.lockTagX} y="40" width="104" height="26" rx="4" fill="#ff8a80" />
                    <text x={RAID.lockTagCx} y="57.5" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="#1a0a09" fontFamily="var(--font-sans)">{t.lockdown}</text>
                  </g>
                  {RAID.ticks.map((tick) => (
                    <text key={tick.label} x={tick.x} y="248" textAnchor="middle" fontSize="12" fill="#a6a6ad" fontFamily="var(--font-sans)">{tick.label}</text>
                  ))}
                </svg>
              </div>
              <ul className="lp-facts">
                {([["A", t.fa, t.faP], ["B", t.fb, t.fbP], ["C", t.fc, t.fcP]] as const).map(([idx, title, body], i) => (
                  <li key={idx} className="lp-rv" style={{ "--d": i } as Vars}>
                    <span className="lp-idx">{idx}</span>
                    <span>
                      <strong style={{ fontWeight: 600 }}>{title}</strong> <span className="lp-muted">{body}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* 02 PHAETHON */}
        <section id="phaethon" className="lp-sec lp-sec-alt" aria-labelledby="ph-t">
          <div className="lp-wrap" style={{ position: "relative", display: "flex", flexDirection: "column", gap: "clamp(40px, 5vw, 80px)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "24px 64px" }}>
              <div className="lp-stack" style={{ maxWidth: 1000 }}>
                <span className="lp-idx">{t.s2idx}</span>
                <Title id="ph-t" text={t.s2h} />
              </div>
              <p className="lp-lead lp-rv" style={{ maxWidth: "30em" }}>{t.s2p}</p>
            </div>

            <div className="lp-bento">
              <div className="lp-card lp-tilt lp-rv lp-span2" style={{ padding: 28, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, justifyContent: "center" }}>
                <svg role="img" aria-label={t.riskAria} viewBox="0 0 240 150" width="100%" style={{ maxWidth: 300, display: "block", height: "auto" }}>
                  <path d="M30 120 A90 90 0 0 1 210 120" fill="none" stroke="#2a2a2d" strokeWidth="14" strokeLinecap="round" />
                  <path d="M30 120 A90 90 0 0 1 210 120" fill="none" stroke="#ff8a80" strokeWidth="14" strokeLinecap="round" className="lp-arc" style={{ "--dl": ".2s" } as Vars} strokeDasharray={`${((GAUGE_LENGTH * RISK_SCORE) / 100).toFixed(1)} 400`} />
                  <text x="120" y="138" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="13" fill="#a6a6ad">/ 100</text>
                </svg>
                <span className="lp-mono" style={{ marginTop: -118, marginBottom: 52, fontSize: 54, fontWeight: 600, lineHeight: 1 }}>
                  <CountUp value={RISK_SCORE} format={int} delay={200} />
                </span>
                <span className="lp-mono" style={{ fontSize: 15, fontWeight: 600 }}>shadow.fox_88</span>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--red)" }}>{t.risk}</span>
              </div>

              <div className="lp-card lp-tilt lp-rv lp-span2" style={{ "--d": 1, padding: 28, display: "flex", flexDirection: "column", gap: 16 } as Vars}>
                <span className="lp-title">{t.why}</span>
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 13 }}>
                  {FACTORS.map(([points, max], i) => (
                    <li key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <span style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
                        <span>{FACTOR_NAMES[lang][i]}</span>
                        <span className="lp-mono" style={{ fontWeight: 600 }}>
                          <CountUp value={points} format={int} duration={1400} delay={250 + i * 90} />{" "}
                          <span className="lp-muted" style={{ fontWeight: 400 }}>/ {max}</span>
                        </span>
                      </span>
                      <span aria-hidden="true" className="lp-bar">
                        <span className="lp-gx" style={{ "--dl": `${0.25 + i * 0.09}s`, width: `${Math.round((points / max) * 100)}%`, background: "#ff8a80" } as Vars} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="lp-card lp-tilt lp-rv lp-span2" style={{ "--d": 2, padding: "28px 20px 20px", display: "flex", flexDirection: "column", gap: 6 } as Vars}>
                <span className="lp-title" style={{ padding: "0 8px" }}>{t.linked}</span>
                <span className="lp-muted" style={{ fontSize: 13.5, padding: "0 8px" }}>{t.linkedSub}</span>
                <svg role="img" aria-label={t.netAria} viewBox="0 0 400 270" width="100%" style={{ display: "block", height: "auto" }}>
                  {LINKED_NODES.map((n) => (
                    <line key={n.name} className="lp-draw" style={{ "--dl": `${0.3 + n.i * 0.08}s` } as Vars} pathLength={1} x1="200" y1="135" x2={n.x} y2={n.y} stroke="#55555a" strokeWidth={n.w} />
                  ))}
                  {LINKED_NODES.map((n) => (
                    <g key={n.name} className="lp-pop" style={{ "--dl": `${0.9 + n.i * 0.1}s` } as Vars}>
                      <circle cx={n.x} cy={n.y} r="19" fill={n.color} />
                      <text x={n.x} y={n.ty} textAnchor="middle" fontSize="12.5" fontWeight="700" fill="#141415" fontFamily="var(--font-mono)">{n.score}</text>
                      <text x={n.x} y={n.ly} textAnchor="middle" fontSize="11" fill="#c4c4ca" fontFamily="var(--font-sans)">{n.name}</text>
                    </g>
                  ))}
                  <circle className="lp-pop" style={{ "--dl": ".2s" } as Vars} cx="200" cy="135" r="10" fill="#121213" stroke="#ff8a80" strokeWidth="3" />
                </svg>
              </div>
            </div>
          </div>
        </section>

        {/* 03 ECONOMY */}
        <section id="economy" className="lp-sec" aria-labelledby="eco-t">
          <div className="lp-wrap" style={{ display: "flex", flexDirection: "column", gap: "clamp(40px, 5vw, 80px)" }}>
            <div className="lp-split" style={{ alignItems: "end" }}>
              <div className="lp-stack">
                <span className="lp-idx">{t.s3idx}</span>
                <Title id="eco-t" text={t.s3h} />
              </div>
              <p className="lp-lead lp-rv">{t.s3p}</p>
            </div>

            <div className="lp-bento">
              <div className="lp-card lp-tilt lp-rv lp-span4" style={{ padding: "clamp(18px, 2vw, 28px)", display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "6px 16px" }}>
                  <span className="lp-title">COIN / GEM</span>
                  <span className="lp-title" style={{ fontSize: 30 }}>
                    <CountUp value={MARKET.last} format={(n) => n.toFixed(2).replace(".", t.dec)} duration={2200} />
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: MARKET.up ? "var(--green)" : "var(--red)" }}>{MARKET.change}</span>
                  <span className="lp-muted" style={{ fontSize: 13, marginLeft: "auto" }}>{t.soon}</span>
                </div>
                <svg role="img" aria-label={t.candleAria} viewBox="0 0 800 260" width="100%" style={{ display: "block", height: "auto" }}>
                  {MARKET.grid.map((g) => (
                    <g key={g.label}>
                      <line className="lp-gx" x1="10" x2="740" y1={g.y} y2={g.y} stroke="#2e2e31" />
                      <text x="750" y={g.ty} fontSize="12" fill="#a6a6ad" fontFamily="var(--font-sans)">{g.label}</text>
                    </g>
                  ))}
                  {MARKET.candles.map((c) => {
                    const color = c.up ? "#4ade80" : "#ff8a80";
                    return (
                      <g key={c.i} className="lp-gy" style={{ "--dl": `${0.15 + c.i * 0.035}s` } as Vars}>
                        <line x1={c.cx} x2={c.cx} y1={c.hy} y2={c.ly} stroke={color} strokeWidth="1.6" />
                        <rect x={c.bx} y={c.by} width={c.bw} height={c.bh} rx="2" fill={color} />
                      </g>
                    );
                  })}
                  <path className="lp-draw" style={{ "--dl": ".5s", "--dur": "1.9s" } as Vars} pathLength={1} d={MARKET.ma} fill="none" stroke="#6aa7ff" strokeWidth="2" strokeLinejoin="round" />
                </svg>
              </div>

              <div className="lp-card lp-tilt lp-rv lp-span2" style={{ "--d": 1, padding: 28, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 24 } as Vars}>
                <span className="lp-title">{t.daily}</span>
                <span className="lp-disp" style={{ fontSize: "clamp(64px, 6vw, 112px)", color: "var(--acc)" }}>
                  <CountUp value={200} format={(n) => `+${Math.round(n)}`} delay={250} />
                </span>
                <span className="lp-muted" style={{ fontSize: 14, lineHeight: 1.5 }}>{t.dailyP}</span>
              </div>

              {GAMES.map((g, i) => (
                <div key={g.name} className="lp-card lp-tilt lp-rv lp-span3" style={{ "--d": i % 2, padding: 24, display: "flex", alignItems: "center", gap: 18 } as Vars}>
                  <span aria-hidden="true" className="lp-game-icon">
                    <Icon d={g.icon} size={26} stroke="var(--acc)" width={1.8} />
                  </span>
                  <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                    <span className="lp-title" style={{ fontSize: 22 }}>{gameName(g.name)}</span>
                    <span className="lp-muted" style={{ fontSize: 14 }}>
                      {t.betsFrom} {int(g.min)} {t.betsTo} {int(g.max)}
                    </span>
                  </span>
                  <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                    <span className="lp-mono" style={{ fontSize: 26, fontWeight: 600 }}>
                      <CountUp value={g.rtp} format={percent} delay={150 + (i % 2) * 90} />
                    </span>
                    <span className="lp-muted" style={{ fontSize: 12.5 }}>{t.paid}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 04 COMMUNITY */}
        <section id="community" className="lp-sec" aria-labelledby="com-t" style={{ paddingTop: 0 }}>
          <div className="lp-wrap lp-split">
            <div className="lp-sticky lp-stack">
              <span className="lp-idx">{t.s4idx}</span>
              <Title id="com-t" text={t.s4h} />
              <p className="lp-lead lp-rv">{t.s4p}</p>
            </div>
            <div className="lp-col">
              <div className="lp-card lp-rv" style={{ padding: 10 }}>
                <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
                  {members.map((m, i) => (
                    <li key={i} className="lp-row">
                      <span className="lp-mono lp-muted" style={{ width: 22, fontSize: 13 }}>{String(i + 1).padStart(2, "0")}</span>
                      {m.photo ? (
                        <Image className="lp-member-av" src={m.photo} alt="" width={44} height={44} sizes="44px" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element -- inline SVG data URI, nothing to optimise
                        <img className="lp-member-av" alt="" src={avatarUri(i)} width={44} height={44} />
                      )}
                      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontSize: 16, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
                        <span className="lp-muted" style={{ fontSize: 13 }}>
                          {ROLE_NAMES[lang][m.role]}
                          {t.since}
                          {joined(m.joined)}
                        </span>
                      </span>
                      <span className="lp-bar lp-hide-sm" style={{ flex: "0 1 220px" }}>
                        <span className="lp-gx" style={{ "--dl": `${0.2 + i * 0.1}s`, width: `${Math.round((m.messages / MEMBERS[0].messages) * 100)}%`, background: "var(--acc)" } as Vars} />
                      </span>
                      <span className="lp-mono lp-msgs">
                        <CountUp value={m.messages} format={(n) => `${int(n)}${t.msgs}`} delay={200 + i * 100} />
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
              <ModuleSwitches lang={lang} />
            </div>
          </div>
        </section>

        {/* 05 DASHBOARD */}
        <section id="dashboard" className="lp-sec" aria-labelledby="dash-t" style={{ paddingTop: 0, overflow: "hidden" }}>
          <div className="lp-wrap" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "clamp(40px, 5vw, 72px)", textAlign: "center" }}>
            <span className="lp-idx">{t.s5idx}</span>
            <Title id="dash-t" text={t.s5h} style={{ maxWidth: "14ch" }} />
            <div className="lp-dash lp-card lp-rv" aria-hidden="true">
              <div className="lp-dash-panel lp-dash-side lp-hide-sm">
                <span className="lp-disp" style={{ fontSize: 18, padding: "0 8px 12px", borderBottom: "2px solid var(--acc)", marginBottom: 8 }}>Sakutina</span>
                {DASH_NAV.map((key, i) => (
                  <span key={key} className="lp-dash-nav" data-current={i === 0}>
                    <Icon d={MODULE_ICONS[key]} size={15} stroke={i === 0 ? "var(--acc)" : "#a6a6ad"} width={1.8} />
                    {nm[key]}
                  </span>
                ))}
              </div>
              <div style={{ flex: 1, minWidth: 0, padding: "18px 12px", display: "flex", flexDirection: "column", gap: 16 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span className="lp-pulse" style={{ width: 11, height: 11 }} />
                  <span className="lp-disp" style={{ fontSize: "clamp(22px, 2.4vw, 36px)", letterSpacing: "-0.02em", lineHeight: 1.1 }}>{t.allsys}</span>
                </span>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap: 12 }}>
                  <Kpi label={t.navSec} color="var(--green)">{t.protected}</Kpi>
                  <Kpi label={t.kpiMessages}>
                    <CountUp value={48213} format={int} duration={2200} />
                  </Kpi>
                  <Kpi label={t.kpiCoins}>
                    <CountUp value={1.2} format={(n) => `${n.toFixed(1).replace(".", t.dec)}${t.mSuffix}`} duration={2200} delay={100} />
                  </Kpi>
                  <Kpi label={t.kpiActive}>
                    <CountUp value={212} format={int} duration={2200} delay={200} />
                  </Kpi>
                </div>
                <div className="lp-dash-charts">
                  <div className="lp-dash-panel" style={{ padding: 16 }}>
                    <svg viewBox="0 0 600 180" width="100%" style={{ display: "block", height: "auto" }}>
                      <path className="lp-draw" style={{ "--dl": ".3s", "--dur": "2.2s" } as Vars} pathLength={1} d={DASH_LINE} fill="none" stroke="var(--acc)" strokeWidth="2.5" strokeLinejoin="round" />
                      <path className="lp-draw" style={{ "--dl": ".6s", "--dur": "2.2s" } as Vars} pathLength={1} d={DASH_LINE_2} fill="none" stroke="#6aa7ff" strokeWidth="2" />
                    </svg>
                  </div>
                  <div className="lp-dash-panel" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                    {DASH_ROWS.map((r, i) => (
                      <span key={r.name} className="lp-slide" style={{ "--dl": `${0.5 + i * 0.15}s`, display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "#1b1b1d", borderRadius: 10, fontSize: 13 } as Vars}>
                        <span className="lp-mono" style={{ fontWeight: 600, color: r.high ? "var(--red)" : "var(--amber)" }}>{r.score}</span>
                        {r.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <a className="lp-btn lp-btn-g" href={loginHref}>
              {t.openDash} {ARROW}
            </a>
          </div>
        </section>

        {/* STEPS */}
        <section className="lp-sec" aria-labelledby="st-t" style={{ paddingTop: 0 }}>
          <div className="lp-wrap" style={{ display: "flex", flexDirection: "column", gap: 56 }}>
            <Title id="st-t" text={t.stepsH} className="lp-h3" />
            <ol className="lp-steps">
              {([[t.st1, t.st1t, t.st1p], [t.st2, t.st2t, t.st2p], [t.st3, t.st3t, t.st3p]] as const).map(([idx, title, body], i) => (
                <li key={idx} className="lp-step lp-rv" style={{ "--d": i } as Vars}>
                  <span className="lp-idx">{idx}</span>
                  <span className="lp-disp lp-step-t">{title}</span>
                  <span className="lp-muted" style={{ fontSize: 16, lineHeight: 1.55 }}>{body}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* FINAL CALL */}
        <section aria-labelledby="cta-t" style={{ borderTop: "1px solid var(--line)", padding: "clamp(80px, 9vw, 160px) 0 clamp(40px, 4vw, 64px)" }}>
          <div className="lp-wrap" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 40 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span aria-hidden="true" className="lp-pp-frame" style={{ width: 56, height: 56 }}>
                <Image className="lp-pp" src={mascot} alt="" width={56} height={56} style={{ objectPosition: "50% 25%" }} />
              </span>
              <span className="lp-idx">{t.ready}</span>
            </span>
            <a href={inviteHref} id="cta-t" className="lp-disp lp-big-cta lp-rv">
              {t.cta}
            </a>
            <footer className="lp-foot">
              <span className="lp-muted">{t.legal}</span>
              <nav aria-label={t.footerAria} style={{ display: "flex", flexWrap: "wrap", gap: 28 }}>
                <a href="#security">{t.navSec}</a>
                <a href="#phaethon">{t.navPh}</a>
                <a href="#economy">{t.navEco}</a>
                <a href="#community">{t.navCom}</a>
                <a href={loginHref}>{t.login}</a>
              </nav>
            </footer>
          </div>
        </section>
      </main>
    </div>
  );
}

function Kpi({ label, color, children }: Readonly<{ label: string; color?: string; children: ReactNode }>) {
  return (
    <div className="lp-dash-panel" style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 4 }}>
      <span className="lp-muted" style={{ fontSize: 12.5 }}>{label}</span>
      <span className="lp-disp" style={{ fontSize: 30, letterSpacing: "-0.02em", color: color ?? "var(--text)" }}>{children}</span>
    </div>
  );
}

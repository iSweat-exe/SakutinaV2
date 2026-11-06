"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
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
import "./landing.css";

const LANG_KEY = "sakutina.landing.lang";

/** CSS custom properties read by the count-up and scroll animations. */
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

/** A number that counts up when it scrolls into view; thousands count as two parts (48 and 213). */
function Count({ value, t }: Readonly<{ value: number; t: Copy }>) {
  if (value < 1000) {
    return <span className="lp-cu" style={{ "--t": value } as Vars} />;
  }
  return (
    <>
      <span className="lp-cu" style={{ "--t": Math.floor(value / 1000) } as Vars} />
      {t.sep}
      <span className="lp-cu3" style={{ "--t": value % 1000 } as Vars} />
    </>
  );
}

const formatNumber = (n: number, t: Copy) => n.toLocaleString("en-US").replace(/,/g, t.sep);

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
      {MODULE_SWITCHES.map(([id, key]) => (
        <div key={id} className="lp-card lp-mod lp-rv" data-on={on[id]}>
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

/**
 * The public landing page of Sakutina, in English or French. Every number on it
 * is sample data (see ./sample.ts). `inviteHref` adds the bot to a server;
 * `loginHref` opens the panel.
 */
export function Landing({ inviteHref, loginHref }: Readonly<{ inviteHref: string; loginHref: string }>) {
  const [lang, setLang] = useState<Lang>("en");
  const t = COPY[lang];
  const nm = MODULE_NAMES[lang];

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

  const gameName = (name: string) => (lang === "fr" ? (GAME_NAMES_FR[name] ?? name) : name);
  const joined = (date: string) => (lang === "fr" ? date.replace(/^\w+/, (m) => MONTHS_FR[m] ?? m) : date);
  const marquee = [...MARQUEE_WORDS, ...MARQUEE_WORDS];

  return (
    <div className="lp">
      <div className="lp-grain" aria-hidden="true" />

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
                <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--green)" }} />
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
                <a className="lp-btn lp-btn-p" href={inviteHref}>
                  {t.add} {ARROW}
                </a>
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
                <svg width="56" height="56" viewBox="0 0 24 24" fill="var(--acc)" style={{ flex: "none" }}>
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
              <h2 id="sec-t" className="lp-disp lp-h2 lp-rv">{t.s1h}</h2>
              <p className="lp-lead lp-rv">{t.s1p}</p>
            </div>
            <div className="lp-col">
              <div className="lp-card lp-rv" style={{ padding: "clamp(18px, 2vw, 32px)", display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "8px 20px", alignItems: "baseline" }}>
                  <span className="lp-title" style={{ fontSize: 22 }}>{t.joinsPm}</span>
                  <span className="lp-muted" style={{ fontSize: 14 }}>{t.joinsRange}</span>
                </div>
                <svg role="img" aria-label={t.raidAria} viewBox="0 0 800 270" width="100%" style={{ display: "block", height: "auto" }}>
                  <rect className="lp-op" style={{ "--a": "30%", "--b": "55%" } as Vars} x={RAID.bandX} y="26" width={RAID.bandW} height="194" fill="#fbbf24" fillOpacity=".12" stroke="#fbbf24" strokeOpacity=".55" strokeDasharray="3 3" />
                  <text x={RAID.bandCx} y="18" textAnchor="middle" fontSize="13" fontWeight="600" fill="#fbbf24" fontFamily="var(--font-sans)">{t.suspected}</text>
                  {RAID.grid.map((g) => (
                    <g key={g.label}>
                      <line x1="40" x2="790" y1={g.y} y2={g.y} stroke="#2e2e31" />
                      <text x="30" y={g.ty} textAnchor="end" fontSize="12" fill="#a6a6ad" fontFamily="var(--font-sans)">{g.label}</text>
                    </g>
                  ))}
                  <path className="lp-op" d={RAID.area} fill="var(--acc)" fillOpacity=".12" />
                  <path className="lp-draw" pathLength={1} d={RAID.line} fill="none" stroke="var(--acc)" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
                  <line x1={RAID.lockX} x2={RAID.lockX} y1="26" y2="220" stroke="#ff8a80" strokeWidth="1.5" />
                  <rect x={RAID.lockTagX} y="40" width="104" height="26" rx="4" fill="#ff8a80" />
                  <text x={RAID.lockTagCx} y="57.5" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="#1a0a09" fontFamily="var(--font-sans)">{t.lockdown}</text>
                  {RAID.ticks.map((tick) => (
                    <text key={tick.label} x={tick.x} y="248" textAnchor="middle" fontSize="12" fill="#a6a6ad" fontFamily="var(--font-sans)">{tick.label}</text>
                  ))}
                </svg>
              </div>
              <ul className="lp-facts lp-rv">
                {([["A", t.fa, t.faP], ["B", t.fb, t.fbP], ["C", t.fc, t.fcP]] as const).map(([idx, title, body]) => (
                  <li key={idx}>
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
                <h2 id="ph-t" className="lp-disp lp-h2 lp-rv">{t.s2h}</h2>
              </div>
              <p className="lp-lead lp-rv" style={{ maxWidth: "30em" }}>{t.s2p}</p>
            </div>

            <div className="lp-bento">
              <div className="lp-card lp-tilt lp-rv lp-span2" style={{ padding: 28, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, justifyContent: "center" }}>
                <svg role="img" aria-label={t.riskAria} viewBox="0 0 240 150" width="100%" style={{ maxWidth: 300, display: "block", height: "auto" }}>
                  <path d="M30 120 A90 90 0 0 1 210 120" fill="none" stroke="#2a2a2d" strokeWidth="14" strokeLinecap="round" />
                  <path d="M30 120 A90 90 0 0 1 210 120" fill="none" stroke="#ff8a80" strokeWidth="14" strokeLinecap="round" className="lp-arc" strokeDasharray={`${((GAUGE_LENGTH * RISK_SCORE) / 100).toFixed(1)} 400`} />
                  <text x="120" y="138" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="13" fill="#a6a6ad">/ 100</text>
                </svg>
                <span className="lp-mono" style={{ marginTop: -118, marginBottom: 52, fontSize: 54, fontWeight: 600, lineHeight: 1 }}>
                  <span className="lp-sr">{RISK_SCORE}</span>
                  <span aria-hidden="true" className="lp-cu" style={{ "--t": RISK_SCORE } as Vars} />
                </span>
                <span className="lp-mono" style={{ fontSize: 15, fontWeight: 600 }}>shadow.fox_88</span>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--red)" }}>{t.risk}</span>
              </div>

              <div className="lp-card lp-tilt lp-rv lp-span2" style={{ padding: 28, display: "flex", flexDirection: "column", gap: 16 }}>
                <span className="lp-title">{t.why}</span>
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 13 }}>
                  {FACTORS.map(([points, max], i) => (
                    <li key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <span style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
                        <span>{FACTOR_NAMES[lang][i]}</span>
                        <span className="lp-mono" style={{ fontWeight: 600 }}>
                          {points} <span className="lp-muted" style={{ fontWeight: 400 }}>/ {max}</span>
                        </span>
                      </span>
                      <span aria-hidden="true" className="lp-bar">
                        <span className="lp-gx" style={{ width: `${Math.round((points / max) * 100)}%`, background: "#ff8a80" }} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="lp-card lp-tilt lp-rv lp-span2" style={{ padding: "28px 20px 20px", display: "flex", flexDirection: "column", gap: 6 }}>
                <span className="lp-title" style={{ padding: "0 8px" }}>{t.linked}</span>
                <span className="lp-muted" style={{ fontSize: 13.5, padding: "0 8px" }}>{t.linkedSub}</span>
                <svg role="img" aria-label={t.netAria} viewBox="0 0 400 270" width="100%" style={{ display: "block", height: "auto" }}>
                  {LINKED_NODES.map((n) => (
                    <line key={n.name} className="lp-draw" pathLength={1} x1="200" y1="135" x2={n.x} y2={n.y} stroke="#55555a" strokeWidth={n.w} />
                  ))}
                  {LINKED_NODES.map((n) => (
                    <g key={n.name} className="lp-op" style={{ "--a": `${n.a}%`, "--b": `${n.b}%`, "--i": n.i } as Vars}>
                      <circle cx={n.x} cy={n.y} r="19" fill={n.color} />
                      <text x={n.x} y={n.ty} textAnchor="middle" fontSize="12.5" fontWeight="700" fill="#141415" fontFamily="var(--font-mono)">{n.score}</text>
                      <text x={n.x} y={n.ly} textAnchor="middle" fontSize="11" fill="#c4c4ca" fontFamily="var(--font-sans)">{n.name}</text>
                    </g>
                  ))}
                  <circle cx="200" cy="135" r="10" fill="#121213" stroke="#ff8a80" strokeWidth="3" />
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
                <h2 id="eco-t" className="lp-disp lp-h2 lp-rv">{t.s3h}</h2>
              </div>
              <p className="lp-lead lp-rv">{t.s3p}</p>
            </div>

            <div className="lp-bento">
              <div className="lp-card lp-tilt lp-rv lp-span4" style={{ padding: "clamp(18px, 2vw, 28px)", display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "6px 16px" }}>
                  <span className="lp-title">COIN / GEM</span>
                  <span className="lp-title" style={{ fontSize: 30 }}>
                    <span className="lp-sr">{MARKET.last.toFixed(2).replace(".", t.dec)}</span>
                    <span aria-hidden="true">
                      <span className="lp-cu" style={{ "--t": MARKET.whole } as Vars} />
                      {t.dec}
                      <span className="lp-cu2" style={{ "--t": MARKET.frac } as Vars} />
                    </span>
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: MARKET.up ? "var(--green)" : "var(--red)" }}>{MARKET.change}</span>
                  <span className="lp-muted" style={{ fontSize: 13, marginLeft: "auto" }}>{t.soon}</span>
                </div>
                <svg role="img" aria-label={t.candleAria} viewBox="0 0 800 260" width="100%" style={{ display: "block", height: "auto" }}>
                  {MARKET.grid.map((g) => (
                    <g key={g.label}>
                      <line x1="10" x2="740" y1={g.y} y2={g.y} stroke="#2e2e31" />
                      <text x="750" y={g.ty} fontSize="12" fill="#a6a6ad" fontFamily="var(--font-sans)">{g.label}</text>
                    </g>
                  ))}
                  <path className="lp-draw" pathLength={1} d={MARKET.ma} fill="none" stroke="#6aa7ff" strokeWidth="2" strokeLinejoin="round" />
                  {MARKET.candles.map((c) => {
                    const color = c.up ? "#4ade80" : "#ff8a80";
                    return (
                      <g key={c.i} className="lp-gy" style={{ "--a": `${c.a}%`, "--b": `${c.b}%`, "--i": c.i } as Vars}>
                        <line x1={c.cx} x2={c.cx} y1={c.hy} y2={c.ly} stroke={color} strokeWidth="1.6" />
                        <rect x={c.bx} y={c.by} width={c.bw} height={c.bh} rx="2" fill={color} />
                      </g>
                    );
                  })}
                </svg>
              </div>

              <div className="lp-card lp-tilt lp-rv lp-span2" style={{ padding: 28, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 24 }}>
                <span className="lp-title">{t.daily}</span>
                <span className="lp-disp" style={{ fontSize: "clamp(64px, 6vw, 112px)", color: "var(--acc)" }}>
                  <span className="lp-sr">+200</span>
                  <span aria-hidden="true">
                    +<span className="lp-cu" style={{ "--t": 200 } as Vars} />
                  </span>
                </span>
                <span className="lp-muted" style={{ fontSize: 14, lineHeight: 1.5 }}>{t.dailyP}</span>
              </div>

              {GAMES.map((g) => (
                <div key={g.name} className="lp-card lp-tilt lp-rv lp-span3" style={{ padding: 24, display: "flex", alignItems: "center", gap: 18 }}>
                  <span aria-hidden="true" className="lp-game-icon">
                    <Icon d={g.icon} size={26} stroke="var(--acc)" width={1.8} />
                  </span>
                  <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                    <span className="lp-title" style={{ fontSize: 22 }}>{gameName(g.name)}</span>
                    <span className="lp-muted" style={{ fontSize: 14 }}>
                      {t.betsFrom} {formatNumber(g.min, t)} {t.betsTo} {formatNumber(g.max, t)}
                    </span>
                  </span>
                  <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                    <span className="lp-mono" style={{ fontSize: 26, fontWeight: 600 }}>
                      <span className="lp-sr">{g.rtp}%</span>
                      <span aria-hidden="true">
                        <span className="lp-cu" style={{ "--t": g.rtp } as Vars} />%
                      </span>
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
              <h2 id="com-t" className="lp-disp lp-h2 lp-rv">{t.s4h}</h2>
              <p className="lp-lead lp-rv">{t.s4p}</p>
            </div>
            <div className="lp-col">
              <div className="lp-card lp-rv" style={{ padding: 10 }}>
                <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
                  {MEMBERS.map((m, i) => (
                    <li key={m.name} className="lp-row">
                      <span className="lp-mono lp-muted" style={{ width: 22, fontSize: 13 }}>{String(i + 1).padStart(2, "0")}</span>
                      {/* eslint-disable-next-line @next/next/no-img-element -- inline SVG data URI, nothing to optimise */}
                      <img alt="" src={avatarUri(i)} width={44} height={44} style={{ flex: "none", width: 44, height: 44, borderRadius: "50%", border: "1px solid #3a3a3e", objectFit: "cover", display: "block" }} />
                      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontSize: 16, fontWeight: 600 }}>{m.name}</span>
                        <span className="lp-muted" style={{ fontSize: 13 }}>
                          {ROLE_NAMES[lang][m.role]}
                          {t.since}
                          {joined(m.joined)}
                        </span>
                      </span>
                      <span className="lp-bar lp-hide-sm" style={{ flex: "0 1 220px" }}>
                        <span className="lp-gx" style={{ width: `${Math.round((m.messages / MEMBERS[0].messages) * 100)}%`, background: "var(--acc)" }} />
                      </span>
                      <span className="lp-mono" style={{ width: 110, textAlign: "right", fontSize: 14, fontWeight: 600 }}>
                        <span className="lp-sr">
                          {formatNumber(m.messages, t)} {t.messages}
                        </span>
                        <span aria-hidden="true">
                          <Count value={m.messages} t={t} />
                          {t.msgs}
                        </span>
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
            <h2 id="dash-t" className="lp-disp lp-h2 lp-rv" style={{ maxWidth: "14ch" }}>{t.s5h}</h2>
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
                  <span style={{ width: 11, height: 11, borderRadius: "50%", background: "var(--green)", flex: "none" }} />
                  <span className="lp-disp" style={{ fontSize: "clamp(22px, 2.4vw, 36px)", letterSpacing: "-0.02em", lineHeight: 1.1 }}>{t.allsys}</span>
                </span>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap: 12 }}>
                  <Kpi label={t.navSec} color="var(--green)">{t.protected}</Kpi>
                  <Kpi label={t.kpiMessages}>
                    <Count value={48213} t={t} />
                  </Kpi>
                  <Kpi label={t.kpiCoins}>
                    <span className="lp-cu" style={{ "--t": 1 } as Vars} />
                    {t.dec}
                    <span className="lp-cu" style={{ "--t": 2 } as Vars} />
                    {t.mSuffix}
                  </Kpi>
                  <Kpi label={t.kpiActive}>
                    <Count value={212} t={t} />
                  </Kpi>
                </div>
                <div className="lp-dash-charts">
                  <div className="lp-dash-panel" style={{ padding: 16 }}>
                    <svg viewBox="0 0 600 180" width="100%" style={{ display: "block", height: "auto" }}>
                      <path className="lp-draw" pathLength={1} d={DASH_LINE} fill="none" stroke="var(--acc)" strokeWidth="2.5" strokeLinejoin="round" />
                      <path className="lp-draw" pathLength={1} d={DASH_LINE_2} fill="none" stroke="#6aa7ff" strokeWidth="2" strokeDasharray="5 4" />
                    </svg>
                  </div>
                  <div className="lp-dash-panel" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                    {DASH_ROWS.map((r) => (
                      <span key={r.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "#1b1b1d", borderRadius: 10, fontSize: 13 }}>
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
            <h2 id="st-t" className="lp-disp lp-rv" style={{ fontSize: "clamp(32px, 3vw, 56px)" }}>{t.stepsH}</h2>
            <ol className="lp-steps">
              {([[t.st1, t.st1t, t.st1p], [t.st2, t.st2t, t.st2p], [t.st3, t.st3t, t.st3p]] as const).map(([idx, title, body]) => (
                <li key={idx} className="lp-step lp-rv">
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
            <a href={inviteHref} id="cta-t" className="lp-disp lp-big-cta">
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

function Kpi({ label, color, children }: Readonly<{ label: string; color?: string; children: React.ReactNode }>) {
  return (
    <div className="lp-dash-panel" style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 4 }}>
      <span className="lp-muted" style={{ fontSize: 12.5 }}>{label}</span>
      <span className="lp-disp" style={{ fontSize: 30, letterSpacing: "-0.02em", color: color ?? "var(--text)" }}>{children}</span>
    </div>
  );
}

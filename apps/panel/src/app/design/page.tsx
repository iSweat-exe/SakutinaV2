import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";

export const metadata: Metadata = { title: "Design system" };

const COLORS = [
  ["Background", "#0e0e0f", "Page canvas"],
  ["Card", "#151516", "Every panel and section"],
  ["Raised", "#1b1b1d", "Rows, inputs, nested cards"],
  ["Border", "#2e2e31", "Card outlines and dividers"],
  ["Text", "#f0efed", "Titles and values"],
  ["Muted", "#a6a6ad", "Labels and helper text"],
  ["Accent", "#ff6a5f", "Primary action, active state, charts"],
  ["Success", "#4ade80", "Healthy, positive"],
  ["Warning", "#fbbf24", "Suspected, medium risk"],
  ["Info", "#6aa7ff", "Secondary series, low risk"],
  ["Danger", "#ff8a80", "High risk, destructive"],
] as const;

const PRINCIPLES = [
  ["Dark, one accent", "Coral only marks what is active or primary. Status colors carry meaning and never decorate."],
  ["Say it once", "Every fact lives in one place. No tile repeats what a header, chart or toggle already shows."],
  ["Show only what applies", "Modules appear when they have something to report, like Phaethon panels for a suspicious member."],
  ["Color is never alone", "States also carry a word or an icon. Text keeps a 4.5 to 1 contrast on its background."],
  ["Built for 1920 by 1080", "A 285 px sidebar folds to 88 px. Content wraps and stretches to fill, with no empty corners."],
] as const;

function Section({ title, note, className, children }: Readonly<{ title: string; note: string; className?: string; children: ReactNode }>) {
  return (
    <section className={`box-border flex min-w-0 flex-col gap-4 rounded-2xl border border-line bg-card p-5 ${className ?? ""}`}>
      <div className="flex flex-col gap-0.5">
        <h2 className="m-0 font-display text-xl font-bold">{title}</h2>
        <span className="text-[12.5px] text-muted">{note}</span>
      </div>
      {children}
    </section>
  );
}

function TypeRow({ sample, spec }: Readonly<{ sample: ReactNode; spec: string }>) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      {sample}
      <span className="text-right text-[12.5px] text-muted">{spec}</span>
    </div>
  );
}

const BTN = "box-border inline-flex min-h-11 items-center rounded-xl px-[18px] text-[13.5px]";

export default function DesignPage() {
  return (
    <div className="box-border flex min-h-screen flex-col gap-6 bg-bg px-12 py-10">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2 border-b-2 border-accent pb-4">
        <h1 className="m-0 font-display text-[38px] leading-[1.1] font-bold tracking-[-0.02em]">Sakutina design system</h1>
        <p className="m-0 text-[15px] text-muted">The tokens and parts every page is built from.</p>
      </header>

      <div className="flex flex-wrap items-stretch gap-4">
        <Section title="Color" note="Dark surfaces, one accent, four status colors" className="flex-[1_1_360px]">
          <div className="flex flex-col gap-3">
            {COLORS.map(([name, hex, use]) => (
              <div key={name} className="flex items-center gap-3">
                <span aria-hidden="true" className="size-11 flex-none rounded-xl border border-line-strong" style={{ background: hex }} />
                <div className="flex min-w-0 flex-col gap-px">
                  <span className="text-sm font-semibold">
                    {name} <span className="font-mono text-xs font-normal text-muted">{hex}</span>
                  </span>
                  <span className="text-[12.5px] text-muted">{use}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <div className="flex min-w-0 flex-[2_1_560px] flex-col gap-4">
          <Section title="Type" note="Two families for the interface, one for data" className="flex-auto">
            <div className="flex flex-col gap-3.5">
              <TypeRow sample={<span className="font-display text-[38px] font-bold tracking-[-0.02em]">Page title</span>} spec="Bricolage Grotesque 700, 38" />
              <TypeRow sample={<span className="font-display text-[28px] font-bold">1.2M</span>} spec="Key figure, 28" />
              <TypeRow sample={<span className="font-display text-xl font-bold">Section title</span>} spec="Bricolage Grotesque 700, 20" />
              <TypeRow sample={<span className="text-sm">Body and table text</span>} spec="DM Sans 400 to 600, 14" />
              <TypeRow sample={<span className="text-[12.5px] text-muted">Helper text and labels</span>} spec="DM Sans 400, 12.5" />
              <TypeRow sample={<span className="font-mono text-[17px] font-semibold">ID 1082 4471</span>} spec="JetBrains Mono, Phaethon data only" />
            </div>
          </Section>

          <Section title="Shape and space" note="Rounded, calm, generous" className="flex-auto">
            <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
              {[
                ["20, sidebar", "rounded-[20px]"],
                ["16, cards", "rounded-2xl"],
                ["12, rows", "rounded-xl"],
                ["10, buttons", "rounded-[10px]"],
              ].map(([label, radius]) => (
                <div key={label} className="flex flex-col items-start gap-1.5">
                  <span className={`h-14 w-[72px] border border-line-strong bg-card ${radius}`} />
                  <span className="text-[12.5px] text-muted">{label}</span>
                </div>
              ))}
              <div className="flex flex-col items-start gap-1.5">
                <span className="h-7 w-[72px] rounded-full border border-line-strong bg-card" />
                <span className="text-[12.5px] text-muted">Pill, filters</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 border-t border-divider pt-3.5">
              <span className="text-[13px] font-semibold">Spacing, in steps of 4</span>
              <div className="flex items-end gap-3.5 text-xs text-muted">
                {[8, 12, 16, 20, 24].map((n) => (
                  <span key={n} className="flex flex-col items-center gap-1">
                    <span className="bg-accent" style={{ width: n, height: n }} />
                    {n}
                  </span>
                ))}
              </div>
              <span className="text-[12.5px] text-muted">
                Cards sit 16 apart. Content has 18 to 20 of inner padding. Anything clickable is at least 44 tall.
              </span>
            </div>
          </Section>
        </div>

        <div className="flex min-w-0 flex-[2_1_520px] flex-col gap-4">
          <Section title="Components" note="Same parts on every page" className="flex-auto">
            <div className="flex flex-col gap-[18px]">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className={`${BTN} bg-accent font-bold text-on-accent`}>Primary</span>
                <span className={`${BTN} border border-line-strong font-semibold`}>Secondary</span>
                <span className={`${BTN} border border-accent bg-[#1f1a1a] font-semibold`}>Hover</span>
                <span className="box-border inline-flex size-11 items-center justify-center rounded-xl border border-line-strong text-fg-soft">
                  <Icon name="collapse" size={18} />
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="box-border inline-flex min-h-9 items-center rounded-full border border-accent bg-selected px-3.5 text-[12.5px] font-semibold">Selected 4</span>
                <span className="box-border inline-flex min-h-9 items-center rounded-full border border-line-strong px-3.5 text-[12.5px] font-semibold text-fg-dim">Idle 2</span>
                <span className="rounded-lg border border-line-strong px-2.5 py-[3px] text-xs font-semibold">Mute</span>
                <span className="rounded-md border border-danger px-2.5 py-0.5 text-xs font-semibold text-danger">High</span>
              </div>
              <div className="flex flex-wrap items-center gap-[18px]">
                <span className="flex items-center gap-2 text-[13px]">
                  <span className="block h-[26px] w-[46px] rounded-[13px] bg-accent p-[3px]"><span className="block size-5 translate-x-5 rounded-full bg-on-accent" /></span>On
                </span>
                <span className="flex items-center gap-2 text-[13px]">
                  <span className="block h-[26px] w-[46px] rounded-[13px] bg-line-strong p-[3px]"><span className="block size-5 rounded-full bg-fg-soft" /></span>Off
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="flex size-11 items-center justify-center rounded-xl border border-line-strong bg-selected text-xl">−</span>
                  <span className="flex h-11 w-[90px] items-center justify-center rounded-xl border border-line bg-bg font-display text-xl font-bold">200</span>
                  <span className="flex size-11 items-center justify-center rounded-xl border border-line-strong bg-selected text-xl">+</span>
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="box-border flex min-h-10 items-center gap-2.5 rounded-[10px] border border-line-strong bg-selected px-2.5 text-sm font-medium text-white">
                  <Icon name="shield" className="text-accent" />Active nav item
                </span>
                <span className="box-border flex min-h-10 items-center gap-2.5 rounded-[10px] border border-transparent px-2.5 text-sm font-medium text-fg-dim">
                  <Icon name="user" className="text-muted" />Idle nav item
                </span>
                <span className="box-border flex min-h-10 items-center gap-2.5 rounded-[10px] border border-line-strong bg-raised px-2.5 text-sm font-medium text-fg-soft">
                  <Icon name="lock" className="text-muted" />Locked: sample layout behind a padlock until its data is wired
                </span>
              </div>
            </div>
          </Section>

          <Section title="Principles" note="How the pages are decided" className="flex-auto">
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {PRINCIPLES.map(([title, text]) => (
                <li key={title} className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold">{title}</span>
                  <span className="text-[12.5px] leading-[1.45] text-muted">{text}</span>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </div>
    </div>
  );
}

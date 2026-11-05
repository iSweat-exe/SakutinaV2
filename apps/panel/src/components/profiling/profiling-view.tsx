"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { number } from "@/lib/format";
import { cn } from "@/lib/cn";

type Member = Readonly<{
  id: number;
  name: string;
  handle: string;
  joined: string;
  roles: ReadonlyArray<string>;
  messages: number;
  voice: string;
  balance: string;
  warns: number;
  days: ReadonlyArray<number>;
}>;

// Sample members shown (locked) until the member stats API exists.
const MEMBERS: ReadonlyArray<Member> = [
  { id: 1, name: "Aiko", handle: "@aiko", joined: "Mar 2024", roles: ["Moderator", "Regular"], messages: 12480, voice: "212 h", balance: "48,200", warns: 0, days: [92, 140, 118, 76, 160, 204, 131] },
  { id: 2, name: "Ren", handle: "@ren.q", joined: "Jun 2024", roles: ["Regular"], messages: 9310, voice: "148 h", balance: "41,950", warns: 1, days: [60, 88, 102, 95, 70, 120, 84] },
  { id: 3, name: "Sora", handle: "@sora", joined: "Jan 2025", roles: ["Booster"], messages: 6720, voice: "305 h", balance: "37,400", warns: 0, days: [40, 55, 38, 72, 66, 90, 58] },
  { id: 4, name: "Hana", handle: "@hana_", joined: "Aug 2025", roles: ["Member"], messages: 3890, voice: "64 h", balance: "29,880", warns: 0, days: [22, 30, 18, 41, 36, 52, 27] },
  { id: 5, name: "Yuki", handle: "@yuki.d", joined: "Oct 2025", roles: ["Member"], messages: 1240, voice: "19 h", balance: "25,100", warns: 2, days: [8, 14, 6, 20, 11, 9, 16] },
  { id: 6, name: "Mika", handle: "@mika", joined: "Feb 2024", roles: ["Admin", "Developer"], messages: 8105, voice: "97 h", balance: "15,300", warns: 0, days: [70, 64, 82, 90, 58, 44, 61] },
];

const DAY_NAMES = ["Fri", "Sat", "Sun", "Mon", "Tue", "Wed", "Thu"];

function MessagesPerDay({ name, days }: Readonly<{ name: string; days: ReadonlyArray<number> }>) {
  const max = Math.max(...days, 1);
  const font = "DM Sans, system-ui, sans-serif";

  return (
    <svg role="img" aria-label={`Messages sent by ${name} on each of the last seven days`} viewBox="0 0 640 190" width="100%" className="block h-auto">
      <line x1="20" x2="620" y1="150" y2="150" stroke="#2e2e31" strokeWidth="1" />
      {days.map((value, i) => {
        const h = Math.round((value / max) * 108) + 4;
        const x = 30 + i * 87;

        return (
          <g key={DAY_NAMES[i]}>
            <rect x={x} y={150 - h} width="48" height={h} rx="6" className="fill-accent" />
            <text x={x + 24} y={150 - h - 6} textAnchor="middle" fontSize="12" fontWeight="600" fill="#e4e4e8" fontFamily={font}>
              {value}
            </text>
            <text x={x + 24} y="174" textAnchor="middle" fontSize="12" fill="#a6a6ad" fontFamily={font}>
              {DAY_NAMES[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function ProfilingView() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number | null>(null);

  const q = query.trim().toLowerCase();
  const list = MEMBERS.filter((m) => !q || m.name.toLowerCase().includes(q) || m.handle.toLowerCase().includes(q));
  const current = list.find((m) => m.id === selected) ?? list[0];

  return (
    <>
      <PageHeader title="Profiling" description="Look up any member to see how they take part in the server." />

      <div className="flex flex-wrap items-start gap-4">
        <Card lock="profiling" labelledBy="h-mem" className="max-w-[460px] flex-[1_1_340px] gap-3.5 px-5 py-[18px]">
          <CardTitle id="h-mem">Members</CardTitle>
          <div className="relative">
            <Icon name="search" size={17} strokeWidth={2} className="absolute top-3.5 left-3.5 text-muted" />
            <label htmlFor="q" className="sr-clip">
              Search members
            </label>
            <input id="q" className="field pl-10" type="search" placeholder="Search by name" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div role="radiogroup" aria-labelledby="h-mem" className="flex flex-col gap-2">
            {list.map((member) => {
              const on = member.id === current?.id;

              return (
                <button
                  key={member.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setSelected(member.id)}
                  className={cn(
                    "box-border flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-xl border px-3 py-1.5 text-left font-sans text-fg hover:border-line-hover",
                    on ? "border-accent bg-raised" : "border-line bg-transparent",
                  )}
                >
                  <Avatar size={34} />
                  <span className="flex min-w-0 flex-1 flex-col gap-px">
                    <span className="text-[14.5px] font-semibold">{member.name}</span>
                    <span className="text-[12.5px] text-muted">{member.handle}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {list.length === 0 ? <p className="m-0 py-3 text-center text-sm text-muted">No member matches that name.</p> : null}
        </Card>

        <Card lock="profiling" labelledBy="h-prof" className="flex-[3_1_520px] gap-5 px-[22px] pt-5 pb-[22px]">
          {current ? (
            <>
              <div className="flex flex-wrap items-center gap-4">
                <Avatar size={72} large />
                <div className="flex min-w-[200px] flex-1 flex-col gap-1">
                  <h2 id="h-prof" className="m-0 font-display text-[30px] font-bold tracking-[-0.01em]">
                    {current.name}
                  </h2>
                  <span className="text-[13.5px] text-muted">
                    {current.handle} • Joined {current.joined}
                  </span>
                </div>
                <ul aria-label="Roles" className="m-0 flex list-none flex-wrap gap-2 p-0">
                  {current.roles.map((role) => (
                    <li key={role} className="rounded-full border border-line-strong px-3 py-1 text-[12.5px] font-semibold text-fg-soft">
                      {role}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(170px,100%),1fr))]">
                {[
                  ["Messages", number(current.messages)],
                  ["Voice time", current.voice],
                  ["Balance", current.balance],
                  ["Warnings", String(current.warns)],
                ].map(([label, value]) => (
                  <div key={label} className="flex flex-col gap-1 rounded-[14px] border border-line bg-raised px-4 py-3.5">
                    <span className="text-[12.5px] text-muted">{label}</span>
                    <span className="font-display text-[26px] font-bold">{value}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="m-0 text-[15px] font-semibold">Messages per day, last 7 days</h3>
                <MessagesPerDay name={current.name} days={current.days} />
              </div>
            </>
          ) : (
            <p className="m-0 py-10 text-center text-sm text-muted">Select a member to see their profile.</p>
          )}
        </Card>
      </div>
    </>
  );
}

"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { searchMembers } from "@/app/servers/[guildId]/profiling/actions";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/cn";
import { memberAvatarUrl } from "@/lib/discord-guilds";
import { dayShort, dayTitle, number, timeAgo } from "@/lib/format";
import { PROFILING_QUERY_MAX, type MemberProfile, type ProfileDay, type Profiling } from "@/lib/panel-db/profiling-schema";

/** From this many characters on, a search also asks the database (members beyond the most active ones). */
const REMOTE_FROM = 2;
const SEARCH_DELAY_MS = 300;

const SEARCH_ERRORS = {
  forbidden: "You no longer manage this server.",
  invalid: "That search is too long.",
  unavailable: "Search is unavailable right now. Try again in a moment.",
} as const;

type Remote = Readonly<{ query: string; members: ReadonlyArray<MemberProfile> }>;

/** "45 min", "3.5 h", "212 h". */
export function voiceTime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = minutes / 60;

  return `${hours < 10 ? Math.round(hours * 10) / 10 : Math.round(hours)} h`;
}

/** "Mar 2025". */
const monthYear = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

const nameOf = (member: MemberProfile) => member.name ?? member.username ?? `Member …${member.memberId.slice(-4)}`;
const handleOf = (member: MemberProfile) => (member.username ? `@${member.username}` : member.memberId);

/** Same test as the database: the name shown, the username, or the exact id. */
function matches(member: MemberProfile, q: string): boolean {
  return (
    !q ||
    member.memberId === q ||
    (member.name?.toLowerCase().includes(q) ?? false) ||
    (member.username?.toLowerCase().includes(q) ?? false)
  );
}

function MessagesPerDay({ name, days }: Readonly<{ name: string; days: ReadonlyArray<ProfileDay> }>) {
  const max = Math.max(...days.map((d) => d.messages), 1);
  const font = "DM Sans, system-ui, sans-serif";
  const step = days.length > 0 ? 600 / days.length : 600;

  return (
    <svg role="img" aria-label={`Messages sent by ${name} on each of the last ${days.length} days`} viewBox="0 0 640 190" width="100%" className="block h-auto">
      <line x1="20" x2="620" y1="150" y2="150" stroke="#2e2e31" strokeWidth="1" />
      {days.map((d, i) => {
        const h = Math.round((d.messages / max) * 108) + 4;
        const x = 20 + i * step + (step - 48) / 2;

        return (
          <g key={d.day}>
            <title>{`${dayTitle(d.day)}: ${number(d.messages)} ${d.messages === 1 ? "message" : "messages"}, ${voiceTime(d.voiceMinutes)} in voice`}</title>
            <rect x={x} y={150 - h} width="48" height={h} rx="6" className={d.messages > 0 ? "fill-accent" : "fill-line"} />
            <text x={x + 24} y={150 - h - 6} textAnchor="middle" fontSize="12" fontWeight="600" fill="#e4e4e8" fontFamily={font}>
              {number(d.messages)}
            </text>
            <text x={x + 24} y="174" textAnchor="middle" fontSize="12" fill="#a6a6ad" fontFamily={font}>
              {i === days.length - 1 ? "Today" : dayShort(d.day)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function MemberProfileCard({ member, now }: Readonly<{ member: MemberProfile; now: Date }>) {
  const name = nameOf(member);
  const avatar = memberAvatarUrl(member.memberId, member.avatar)?.replace("size=64", "size=128") ?? null;
  const week = member.days.reduce((sum, d) => sum + d.messages, 0);
  const stats = [
    ["Messages · 30 d", number(member.messages30d), `${number(member.messagesTotal)} since joining`],
    ["Voice · 30 d", voiceTime(member.voiceMinutes30d), `${voiceTime(member.voiceMinutesTotal)} since joining`],
    ["Balance", number(member.balance), null],
    ["Warnings", number(member.warnings), null],
  ] as const;

  return (
    <>
      <div className="flex flex-wrap items-center gap-4">
        <Avatar src={avatar} size={72} large />
        <div className="flex min-w-[200px] flex-1 flex-col gap-1">
          <h2 id="h-prof" className="m-0 font-display text-[30px] font-bold tracking-[-0.01em] break-words">
            {name}
          </h2>
          <span className="text-[13.5px] text-muted">
            {handleOf(member)} • Joined {monthYear(member.joinedAt)} •{" "}
            {member.lastActiveAt ? `Active ${timeAgo(new Date(member.lastActiveAt), now)}` : "Never active"}
          </span>
        </div>
        {member.roles.length > 0 ? (
          <ul aria-label="Roles" className="m-0 flex list-none flex-wrap gap-2 p-0">
            {member.roles.map((role, i) => (
              <li key={`${role}-${i}`} className="rounded-full border border-line-strong px-3 py-1 text-[12.5px] font-semibold text-fg-soft">
                {role}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-[12.5px] text-muted">No roles</span>
        )}
      </div>

      <dl className="m-0 grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(132px,100%),1fr))]">
        {stats.map(([label, value, total]) => (
          <div key={label} className="flex flex-col gap-1 rounded-[14px] border border-line bg-raised px-4 py-3.5">
            <dt className="text-[12.5px] text-muted">{label}</dt>
            <dd className="m-0 flex flex-col gap-0.5">
              <span className={cn("font-display text-[26px] font-bold", label === "Warnings" && member.warnings > 0 && "text-warning")}>{value}</span>
              {total ? <span className="text-[12px] text-muted">{total}</span> : null}
            </dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="m-0 text-[15px] font-semibold">Messages per day, last 7 days</h3>
          <span className="text-[12.5px] text-muted">
            {number(week)} this week · days in UTC
          </span>
        </div>
        <MessagesPerDay name={name} days={member.days} />
      </div>
    </>
  );
}

/** Member profiles: the most active members of the server, any other member by search, and the selected one's figures. */
export function ProfilingView({ guildId, profiling }: Readonly<{ guildId: string; profiling: Profiling }>) {
  const now = useMemo(() => new Date(profiling.generatedAt), [profiling.generatedAt]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [remote, setRemote] = useState<Remote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();

  const q = query.trim().toLowerCase();

  // Beyond the members loaded with the page: ask the database once typing pauses.
  useEffect(() => {
    if (q.length < REMOTE_FROM || q.length > PROFILING_QUERY_MAX) {
      return;
    }

    const timer = setTimeout(() => {
      startSearch(async () => {
        const result = await searchMembers(guildId, q);

        if (result.ok) {
          setRemote({ query: result.query.toLowerCase(), members: result.members });
          setError(null);
        } else {
          setError(SEARCH_ERRORS[result.error]);
        }
      });
    }, SEARCH_DELAY_MS);

    return () => clearTimeout(timer);
  }, [guildId, q]);

  const list = useMemo(() => {
    const local = profiling.members.filter((m) => matches(m, q));

    if (q.length < REMOTE_FROM || remote?.query !== q) {
      return local;
    }

    const seen = new Set(local.map((m) => m.memberId));

    return [...local, ...remote.members.filter((m) => !seen.has(m.memberId))];
  }, [profiling.members, q, remote]);

  const current = list.find((m) => m.memberId === selected) ?? list[0];
  const waiting = q.length >= REMOTE_FROM && (searching || remote?.query !== q) && !error;

  return (
    <>
      <PageHeader
        title="Profiling"
        description={`Look up any of the ${number(profiling.membersPresent)} members to see how they take part in the server.`}
      />

      <div className="flex flex-wrap items-start gap-4">
        <Card labelledBy="h-mem" className="max-w-[460px] flex-[1_1_340px] gap-3.5 px-5 py-[18px]">
          <div className="flex items-baseline justify-between gap-3">
            <CardTitle id="h-mem">Members</CardTitle>
            <span className="text-[12.5px] text-muted">{q ? `${number(list.length)} found` : "Most active, 30 days"}</span>
          </div>
          <div className="relative">
            <Icon name="search" size={17} strokeWidth={2} className="absolute top-3.5 left-3.5 text-muted" />
            <label htmlFor="q" className="sr-clip">
              Search members
            </label>
            <input
              id="q"
              className="field pl-10"
              type="search"
              placeholder="Search by name, username or ID"
              maxLength={PROFILING_QUERY_MAX}
              autoComplete="off"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setError(null);
              }}
            />
          </div>
          <p aria-live="polite" className={cn("m-0 text-[12.5px]", error ? "text-danger" : "text-muted", !error && !waiting && "sr-clip")}>
            {error ?? (waiting ? "Searching every member…" : `${number(list.length)} members shown`)}
          </p>
          <div role="radiogroup" aria-labelledby="h-mem" className="flex max-h-[640px] flex-col gap-2 overflow-y-auto">
            {list.map((member) => {
              const on = member.memberId === current?.memberId;

              return (
                <button
                  key={member.memberId}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    setSelected(member.memberId);
                    // On a phone the profile sits under the list: bring it into view.
                    if (window.matchMedia("(max-width: 899px)").matches) {
                      document.getElementById("profile")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }
                  }}
                  className={cn(
                    "box-border flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-xl border px-3 py-1.5 text-left font-sans text-fg hover:border-line-hover",
                    on ? "border-accent bg-raised" : "border-line bg-transparent",
                  )}
                >
                  <Avatar src={memberAvatarUrl(member.memberId, member.avatar)} size={34} />
                  <span className="flex min-w-0 flex-1 flex-col gap-px">
                    <span className="truncate text-[14.5px] font-semibold">{nameOf(member)}</span>
                    <span className="truncate text-[12.5px] text-muted">{handleOf(member)}</span>
                  </span>
                  <span className="flex-none text-right text-[12.5px] text-muted">
                    <span className="font-semibold text-fg-soft">{number(member.messages30d)}</span> msgs
                  </span>
                </button>
              );
            })}
          </div>
          {list.length === 0 && !waiting ? (
            <p className="m-0 py-3 text-center text-sm text-muted">
              {q ? "No member matches that search." : "The bot has not seen any member of this server yet."}
            </p>
          ) : null}
        </Card>

        <Card labelledBy="h-prof" className="flex-[3_1_520px] scroll-mt-20 gap-5 px-[22px] pt-5 pb-[22px]" id="profile">
          {current ? (
            <MemberProfileCard member={current} now={now} />
          ) : (
            <p id="h-prof" className="m-0 py-10 text-center text-sm text-muted">
              Select a member to see their profile.
            </p>
          )}
        </Card>
      </div>
    </>
  );
}

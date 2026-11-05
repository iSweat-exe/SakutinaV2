"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Locked } from "@/components/ui/locked";
import { PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { SettingRow } from "@/components/ui/setting-row";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { Switch } from "@/components/ui/switch";
import { Tag } from "@/components/ui/tag";

type SanctionType = "Mute" | "Ban" | "Warn";
type Sanction = Readonly<{ id: number; member: string; type: SanctionType; reason: string; by: string; ends: string }>;

// Sample sanctions shown (locked) until the moderation API exists.
const SANCTIONS: ReadonlyArray<Sanction> = [
  { id: 1, member: "shadow.fox_88", type: "Mute", reason: "Link spam in 3 channels", by: "Mika", ends: "In 52 min" },
  { id: 2, member: "nova_trade", type: "Mute", reason: "Link filter triggered", by: "Sakutina", ends: "In 24 min" },
  { id: 3, member: "kaito.alt2", type: "Ban", reason: "Ban evasion", by: "Mika", ends: "Permanent" },
  { id: 4, member: "pixel_ren", type: "Warn", reason: "Insulting another member", by: "Aiko", ends: "Expires in 6 days" },
  { id: 5, member: "echo.vale", type: "Mute", reason: "Mention spam", by: "Sakutina", ends: "In 8 min" },
  { id: 6, member: "lumen_77", type: "Ban", reason: "Took part in a raid", by: "Sakutina", ends: "Permanent" },
  { id: 7, member: "drift.kuro", type: "Warn", reason: "Off-topic in announcements", by: "Aiko", ends: "Expires in 12 days" },
];

const RULES = [
  { id: "spam", label: "Spam filter", desc: "Mute members who repeat messages quickly", on: true },
  { id: "links", label: "Link filter", desc: "Remove invites and unknown links from new members", on: true },
  { id: "words", label: "Banned words", desc: "Delete messages that match the server word list", on: false },
  { id: "mentions", label: "Mention limit", desc: "Mute members who ping more than 5 people at once", on: true },
] as const;

const DURATIONS = ["10 min", "1 hour", "24 hours"] as const;
type Duration = (typeof DURATIONS)[number];
type Filter = "All" | SanctionType;

export function ModerationView() {
  const [revoked, setRevoked] = useState<ReadonlyArray<number>>([]);
  const [filter, setFilter] = useState<Filter>("All");
  const [rules, setRules] = useState<Record<string, boolean>>(Object.fromEntries(RULES.map((r) => [r.id, r.on])));
  const [duration, setDuration] = useState<Duration>("1 hour");

  const live = SANCTIONS.filter((s) => !revoked.includes(s.id));
  const countOf = (type: SanctionType) => live.filter((s) => s.type === type).length;
  const rows = live.filter((s) => filter === "All" || s.type === filter);

  return (
    <>
      <PageHeader title="Moderation" description="Review active sanctions and set the rules Sakutina enforces on its own." />

      <Locked feature="moderation" className="rounded-2xl">
        <StatGrid>
          <StatCard label="Actions, last 24 h" value="23" sub="9 by Sakutina, 14 by moderators" />
          <StatCard label="Warnings, 7 days" value="31" sub="4 members with 2 or more" />
        </StatGrid>
      </Locked>

      <div className="flex flex-wrap gap-4">
        <Card lock="moderation" labelledBy="h-san" className="flex-[3_1_520px] gap-3.5 px-5 pt-[18px] pb-2.5">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
            <CardTitle id="h-san">Active sanctions</CardTitle>
            <Segmented
              label="Filter by type"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "All", label: `All (${live.length})` },
                { value: "Mute", label: `Mute (${countOf("Mute")})` },
                { value: "Ban", label: `Ban (${countOf("Ban")})` },
                { value: "Warn", label: `Warn (${countOf("Warn")})` },
              ]}
            />
          </div>
          <DataTable
            minWidth={640}
            cellPadding={9}
            head={["Member", "Type", "Reason", "By", "Ends", <span key="a" className="sr-clip">Action</span>]}
          >
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="font-semibold">
                  <span className="flex items-center gap-2.5">
                    <Avatar size={32} />
                    {row.member}
                  </span>
                </td>
                <td>
                  <Tag className="min-w-[52px]">{row.type}</Tag>
                </td>
                <td className="text-fg-dim!">{row.reason}</td>
                <td className="text-fg-dim!">{row.by}</td>
                <td className="text-fg-dim!">{row.ends}</td>
                <td className="text-right">
                  <button
                    type="button"
                    aria-label={`Revoke ${row.type} for ${row.member}`}
                    onClick={() => setRevoked((current) => [...current, row.id])}
                    className="min-h-11 cursor-pointer rounded-[10px] border border-line-strong bg-transparent px-3.5 text-[13px] font-semibold text-fg hover:border-accent hover:bg-[#1f1a1a]"
                  >
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
          </DataTable>
        </Card>

        <Card lock="settings" labelledBy="h-auto" className="flex-[2_1_340px] gap-3 self-start px-5 py-[18px]">
          <CardTitle id="h-auto">Auto-moderation</CardTitle>
          {RULES.map((rule) => (
            <SettingRow key={rule.id} label={rule.label} description={rule.desc}>
              <Switch
                label={rule.label}
                checked={rules[rule.id] ?? false}
                onChange={(next) => setRules((current) => ({ ...current, [rule.id]: next }))}
              />
            </SettingRow>
          ))}
          <div className="flex flex-col gap-2 border-t border-divider pt-3.5">
            <span id="dur-l" className="text-[14.5px] font-semibold">
              Default mute duration
            </span>
            <Segmented
              labelledBy="dur-l"
              value={duration}
              onChange={setDuration}
              options={DURATIONS.map((value) => ({ value, label: value }))}
            />
          </div>
        </Card>
      </div>
    </>
  );
}

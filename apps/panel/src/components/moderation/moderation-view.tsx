"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import { revoke, saveAutomod, type ActionError } from "@/app/servers/[guildId]/moderation/actions";
import { GuildAvatar } from "@/components/servers/guild-avatar";
import { Card, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Segmented } from "@/components/ui/segmented";
import { SettingRow } from "@/components/ui/setting-row";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { Switch } from "@/components/ui/switch";
import { Tag } from "@/components/ui/tag";
import { memberAvatarUrl } from "@/lib/discord-guilds";
import { number, timeUntil } from "@/lib/format";
import { AUTOMOD_LIMITS, type ActiveSanction, type Automod, type Moderation, type SanctionKind } from "@/lib/panel-db/moderation-schema";

const KINDS: Readonly<Record<SanctionKind, string>> = { mute: "Mute", ban: "Ban", warn: "Warn" };
type Filter = "All" | SanctionKind;

const FILTER_LABEL: Readonly<Record<Filter, string>> = { All: "All", mute: "Mute", ban: "Ban", warn: "Warn" };

const RULES = [
  { id: "spam", label: "Spam filter", desc: "Mute members who repeat messages or send them in bursts" },
  { id: "links", label: "Link filter", desc: "Remove invites and links from members who joined less than 7 days ago" },
  { id: "words", label: "Banned words", desc: "Delete messages that contain a word from the list below" },
  { id: "mentions", label: "Mention limit", desc: "Mute members who ping more than 5 people at once" },
] as const;

const PRESETS = [
  { minutes: 10, label: "10 min" },
  { minutes: 60, label: "1 hour" },
  { minutes: 1_440, label: "24 hours" },
] as const;

const MESSAGES: Readonly<Record<ActionError, string>> = {
  forbidden: "Your Discord account cannot change this server's moderation.",
  invalid: "One of the values is out of range. Check them and try again.",
  unavailable: "That could not be saved right now. Try again in a moment.",
};

/** How long a mute lasts, in words. */
function minutesLabel(minutes: number): string {
  if (minutes % 1_440 === 0) return `${minutes / 1_440} day${minutes === 1_440 ? "" : "s"}`;
  if (minutes % 60 === 0) return `${minutes / 60} hour${minutes === 60 ? "" : "s"}`;
  return `${number(minutes)} min`;
}

function endsLabel(sanction: ActiveSanction, now: number): string {
  if (sanction.kind === "ban" || sanction.endsAt === null) {
    return "Permanent";
  }

  const left = timeUntil(sanction.endsAt, now);

  return sanction.kind === "warn" ? `Expires in ${left}` : `In ${left}`;
}

/** The server's moderation as the database reports it: stats, active sanctions you can lift, and the auto-moderation. */
export function ModerationView({ guildId, moderation }: Readonly<{ guildId: string; moderation: Moderation }>) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("All");
  const [pending, startAction] = useTransition();
  const [notice, setNotice] = useState<Readonly<{ tone: "ok" | "error"; text: string }> | null>(null);
  const now = Date.parse(moderation.generatedAt);

  const sanctions = moderation.sanctions;
  const countOf = (kind: SanctionKind) => sanctions.filter((s) => s.kind === kind).length;
  const rows = sanctions.filter((s) => filter === "All" || s.kind === filter);
  const waiting = sanctions.some((s) => s.revokeStatus === "pending");

  // The bot lifts a mute or a ban within seconds: look again until it has.
  useEffect(() => {
    if (!waiting) {
      return;
    }

    const timer = setTimeout(() => router.refresh(), 3_000);

    return () => clearTimeout(timer);
  }, [waiting, router, moderation.generatedAt]);

  function lift(sanction: ActiveSanction) {
    setNotice(null);
    startAction(async () => {
      const [kind, id] = sanction.id.split(":") as [SanctionKind, string];
      const result = await revoke(guildId, kind, Number(id));

      if (result.ok) {
        setNotice({ tone: "ok", text: result.status === "done" ? "Warning removed." : "Asked the bot to lift it. This takes a few seconds." });
        router.refresh();
      } else {
        setNotice({ tone: "error", text: MESSAGES[result.error] });
      }
    });
  }

  return (
    <>
      <StatGrid>
        <StatCard
          label="Actions, last 24 h"
          value={number(moderation.actions24h)}
          sub={`${number(moderation.actionsByBot24h)} by Sakutina, ${number(moderation.actions24h - moderation.actionsByBot24h)} by moderators`}
        />
        <StatCard
          label="Warnings, 7 days"
          value={number(moderation.warnings7d)}
          sub={`${number(moderation.warnedMembers2plus)} ${moderation.warnedMembers2plus === 1 ? "member" : "members"} with 2 or more`}
        />
      </StatGrid>

      <div className="flex flex-wrap gap-4">
        <Card labelledBy="h-san" className="flex-[3_1_520px] gap-3.5 px-5 pt-[18px] pb-2.5">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
            <CardTitle id="h-san">Active sanctions</CardTitle>
            <Segmented
              label="Filter by type"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "All", label: `${FILTER_LABEL.All} (${sanctions.length})` },
                { value: "mute", label: `${FILTER_LABEL.mute} (${countOf("mute")})` },
                { value: "ban", label: `${FILTER_LABEL.ban} (${countOf("ban")})` },
                { value: "warn", label: `${FILTER_LABEL.warn} (${countOf("warn")})` },
              ]}
            />
          </div>
          <span role="status" className={`min-h-4 text-[13px] ${notice?.tone === "error" ? "text-danger" : "text-muted"}`}>
            {notice?.text ?? ""}
          </span>
          {rows.length === 0 ? (
            <p className="m-0 pb-4 text-sm text-muted">
              {sanctions.length === 0 ? "No active sanction. Mutes, bans and warnings appear here while they last." : "Nothing of this type is active."}
            </p>
          ) : (
            <DataTable
              minWidth={680}
              cellPadding={9}
              head={["Member", "Type", "Reason", "By", "Ends", <span key="a" className="sr-clip">Action</span>]}
            >
              {rows.map((row) => {
                const name = row.name ?? `Member …${row.memberId.slice(-6)}`;

                return (
                  <tr key={row.id}>
                    <td className="font-semibold">
                      <span className="flex items-center gap-2.5">
                        <GuildAvatar name={name} iconUrl={memberAvatarUrl(row.memberId, row.avatar)} size={32} className="border border-[#55555a] bg-selected" />
                        <span className="max-w-44 truncate" title={`Discord ID ${row.memberId}`}>
                          {name}
                        </span>
                      </span>
                    </td>
                    <td>
                      <Tag className="min-w-[52px]">{KINDS[row.kind]}</Tag>
                    </td>
                    <td className="max-w-56 truncate text-fg-dim!" title={row.reason}>
                      {row.reason}
                    </td>
                    <td className="text-fg-dim!">{row.by}</td>
                    <td className="text-fg-dim! whitespace-nowrap">{endsLabel(row, now)}</td>
                    <td className="text-right">
                      <button
                        type="button"
                        aria-label={`Revoke ${KINDS[row.kind]} for ${name}`}
                        disabled={pending || row.revokeStatus === "pending"}
                        onClick={() => lift(row)}
                        className="min-h-11 cursor-pointer rounded-[10px] border border-line-strong bg-transparent px-3.5 text-[13px] font-semibold text-fg hover:border-accent hover:bg-[#1f1a1a] disabled:cursor-wait disabled:opacity-55"
                      >
                        {row.revokeStatus === "pending" ? "Lifting…" : row.revokeStatus === "failed" ? "Retry" : "Revoke"}
                      </button>
                      {row.revokeStatus === "failed" ? (
                        <span className="mt-1 block text-[11.5px] text-danger">The bot could not lift it. Check its permissions.</span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </DataTable>
          )}
        </Card>

        <AutomodCard guildId={guildId} initial={moderation.automod} />
      </div>
    </>
  );
}

/** The four filters, the words list and the default mute length. Each switch saves at once. */
function AutomodCard({ guildId, initial }: Readonly<{ guildId: string; initial: Automod }>) {
  const [saved, setSaved] = useState(initial);
  const [words, setWords] = useState(initial.bannedWords.join("\n"));
  const [busy, startSaving] = useTransition();
  const [notice, setNotice] = useState<Readonly<{ tone: "ok" | "error"; text: string }> | null>(null);
  const wordsId = useId();
  const durationId = useId();

  const draftWords = words.split(/[\n,]/).map((word) => word.trim().toLowerCase()).filter(Boolean);
  const wordsDirty = [...new Set(draftWords)].sort().join("\n") !== [...saved.bannedWords].sort().join("\n");
  const preset = PRESETS.some((p) => p.minutes === saved.muteMinutes);

  function save(patch: Partial<Automod>, done: string) {
    setNotice(null);
    startSaving(async () => {
      const result = await saveAutomod(guildId, patch);

      if (result.ok) {
        setSaved(result.automod);
        setWords(result.automod.bannedWords.join("\n"));
        setNotice({ tone: "ok", text: done });
      } else {
        setNotice({ tone: "error", text: MESSAGES[result.error] });
      }
    });
  }

  return (
    <Card labelledBy="h-auto" className="flex-[2_1_340px] gap-3 self-start px-5 py-[18px]">
      <CardTitle id="h-auto">Auto-moderation</CardTitle>
      <p className="m-0 text-[12.5px] text-muted">
        Moderators, administrators and anyone who can manage messages are never filtered. Sakutina needs the Manage Messages and Moderate Members permissions.
      </p>
      {RULES.map((rule) => (
        <SettingRow key={rule.id} label={rule.label} description={rule.desc}>
          <Switch
            label={rule.label}
            checked={saved[rule.id]}
            onChange={(next) => !busy && save({ [rule.id]: next }, `${rule.label} ${next ? "on" : "off"}.`)}
          />
        </SettingRow>
      ))}

      <div className="flex flex-col gap-2 border-t border-divider pt-3.5">
        <label htmlFor={wordsId} className="text-[14.5px] font-semibold">
          Banned words
        </label>
        <textarea
          id={wordsId}
          value={words}
          onChange={(event) => setWords(event.target.value)}
          rows={4}
          spellCheck={false}
          placeholder="One word or phrase per line"
          className="box-border w-full resize-y rounded-xl border border-line bg-bg px-3 py-2.5 text-sm text-fg focus:border-accent focus:outline-none"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[12.5px] text-muted">
            {draftWords.length} of {AUTOMOD_LIMITS.bannedWords.count} words. Whole words, any case.
          </span>
          <button
            type="button"
            disabled={!wordsDirty || busy}
            onClick={() => save({ bannedWords: draftWords }, "Banned words saved.")}
            className="min-h-11 cursor-pointer rounded-xl border border-transparent bg-accent px-4 text-sm font-semibold text-on-accent hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Save words
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-divider pt-3.5">
        <span id={durationId} className="text-[14.5px] font-semibold">
          Default mute duration
        </span>
        <Segmented
          labelledBy={durationId}
          value={String(saved.muteMinutes)}
          onChange={(minutes) => !busy && save({ muteMinutes: Number(minutes) }, "Default mute duration saved.")}
          options={[
            ...PRESETS.map((p) => ({ value: String(p.minutes), label: p.label })),
            ...(preset ? [] : [{ value: String(saved.muteMinutes), label: minutesLabel(saved.muteMinutes) }]),
          ]}
        />
      </div>

      <span role="status" className={`min-h-4 text-[13px] ${notice?.tone === "error" ? "text-danger" : "text-muted"}`}>
        {notice?.text ?? ""}
      </span>
    </Card>
  );
}

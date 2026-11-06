"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import { payOutFromTreasury, searchMembers, type PayOutResult } from "@/app/servers/[guildId]/balance/actions";
import { GuildAvatar } from "@/components/servers/guild-avatar";
import { Card, CardTitle } from "@/components/ui/card";
import { memberAvatarUrl } from "@/lib/discord-guilds";
import { number, short, signed, timeAgo } from "@/lib/format";
import { PAYOUT_LIMITS, describeMovement, type MemberHit, type Treasury } from "@/lib/panel-db/treasury-schema";

const MESSAGES: Record<Extract<PayOutResult, { ok: false }>["error"], string> = {
  forbidden: "Your Discord account cannot pay out from this server's treasury.",
  invalid: "Check the member and the amount, then try again.",
  insufficient: "The treasury does not hold that much.",
  limit: "That would take the member's wallet over the maximum balance.",
  unavailable: "The pay out could not be made right now. Try again in a moment.",
};

const FIELD =
  "box-border flex h-11 w-full items-center rounded-xl border border-line bg-bg px-3 focus-within:border-accent";

/** Who receives the pay out: type two letters of a name, pick the member. */
function MemberPicker({
  guildId,
  chosen,
  onChoose,
}: Readonly<{ guildId: string; chosen: MemberHit | null; onChoose: (member: MemberHit | null) => void }>) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<readonly MemberHit[]>([]);
  const [searching, setSearching] = useState(false);
  const id = useId();

  useEffect(() => {
    const text = query.trim();

    if (chosen || text.length < 2) {
      return;
    }

    let current = true;
    const timer = setTimeout(() => {
      setSearching(true);
      searchMembers(guildId, text)
        .then((found) => current && setHits(found))
        .finally(() => current && setSearching(false));
    }, 250);

    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [guildId, query, chosen]);

  if (chosen) {
    return (
      <div className={`${FIELD} justify-between gap-2`}>
        <span className="flex min-w-0 items-center gap-2.5">
          <GuildAvatar name={chosen.name} iconUrl={memberAvatarUrl(chosen.memberId, chosen.avatar)} size={24} className="bg-selected" />
          <span className="truncate text-sm font-semibold">{chosen.name}</span>
        </span>
        <button
          type="button"
          onClick={() => {
            onChoose(null);
            setQuery("");
            setHits([]);
          }}
          className="flex-none cursor-pointer border-0 bg-transparent text-[13px] font-semibold text-accent hover:underline"
        >
          Change
        </button>
      </div>
    );
  }

  const text = query.trim();

  return (
    <div className="flex flex-col gap-2">
      <div className={FIELD}>
        <label htmlFor={id} className="sr-clip">
          Member to pay
        </label>
        <input
          id={id}
          className="bare text-left"
          type="search"
          autoComplete="off"
          placeholder="Search a member by name"
          maxLength={40}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {text.length >= 2 ? (
        <ul className="m-0 flex list-none flex-col gap-1 p-0" aria-label="Matching members">
          {hits.map((member) => (
            <li key={member.memberId}>
              <button
                type="button"
                onClick={() => onChoose(member)}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-transparent bg-transparent px-2 py-1.5 text-left hover:border-line-strong hover:bg-selected"
              >
                <GuildAvatar name={member.name} iconUrl={memberAvatarUrl(member.memberId, member.avatar)} size={24} className="bg-selected" />
                <span className="truncate text-sm font-semibold">{member.name}</span>
              </button>
            </li>
          ))}
          {hits.length === 0 ? (
            <li className="px-2 text-[12.5px] text-muted">{searching ? "Searching…" : "No member of this server matches."}</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

/** Pay a sum from the treasury to a member: audited with the administrator's name, journaled in the member's history. */
function PayOutForm({ guildId, balance, unit }: Readonly<{ guildId: string; balance: number; unit: string }>) {
  const router = useRouter();
  const [member, setMember] = useState<MemberHit | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  // A new picker (empty search) after each pay out.
  const [round, setRound] = useState(0);
  const [pending, startPaying] = useTransition();
  const [notice, setNotice] = useState<Readonly<{ tone: "ok" | "error"; text: string }> | null>(null);
  const amountId = useId();
  const noteId = useId();

  const value = Number(amount);
  const valid = member !== null && Number.isSafeInteger(value) && value >= 1 && value <= Math.min(balance, PAYOUT_LIMITS.amountMax);

  function submit() {
    if (!member || !valid) {
      return;
    }

    setNotice(null);
    startPaying(async () => {
      const result = await payOutFromTreasury(guildId, member.memberId, value, note);

      if (result.ok) {
        setNotice({ tone: "ok", text: `Paid ${number(value)} ${unit.toLowerCase()} to ${member.name}.` });
        setMember(null);
        setAmount("");
        setNote("");
        setRound((current) => current + 1);
        router.refresh();
      } else {
        setNotice({ tone: "error", text: MESSAGES[result.error] });
      }
    });
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <MemberPicker key={round} guildId={guildId} chosen={member} onChoose={setMember} />

      <div className={FIELD}>
        <label htmlFor={amountId} className="sr-clip">
          Amount to pay
        </label>
        <input
          id={amountId}
          className="bare no-spin text-left"
          type="number"
          inputMode="numeric"
          min={1}
          max={Math.min(balance, PAYOUT_LIMITS.amountMax)}
          placeholder="Amount"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
        <span className="flex-none text-[12.5px] text-muted">{unit.toLowerCase()}</span>
      </div>

      <div className={FIELD}>
        <label htmlFor={noteId} className="sr-clip">
          Reason (optional)
        </label>
        <input
          id={noteId}
          className="bare text-left"
          type="text"
          maxLength={PAYOUT_LIMITS.noteMax}
          placeholder="Reason (optional), e.g. event prize"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!valid || pending}
          className="min-h-11 cursor-pointer rounded-xl border border-transparent bg-accent px-5 text-sm font-semibold text-on-accent hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {pending ? "Paying…" : "Pay out"}
        </button>
        <span role="status" className={`text-[13px] ${notice?.tone === "error" ? "text-danger" : "text-muted"}`}>
          {notice?.text ?? (balance === 0 ? "The treasury is empty." : "")}
        </span>
      </div>
    </form>
  );
}

/** The reserve of the closed economy: what it collects and pays out, with a form to pay a member from it. */
export function TreasuryCard({ guildId, treasury, unit }: Readonly<{ guildId: string; treasury: Treasury; unit: string }>) {
  const now = new Date(treasury.generatedAt);

  return (
    <Card labelledBy="h-treasury" className="gap-4 px-5 pt-[18px] pb-[22px]">
      <CardTitle id="h-treasury">Reserve</CardTitle>
      <div className="grid gap-x-8 gap-y-6 [grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr))]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="font-display text-[34px] leading-none font-bold" title={`${number(treasury.balance)} ${unit}`}>
              {short(treasury.balance)}
            </span>
            <span className="text-[12.5px] text-muted">
              Salaries, interest and taxes go through it · last 24 h: +{short(treasury.in24h)} in, −{short(treasury.out24h)} out
            </span>
          </div>

          {treasury.recent.length === 0 ? (
            <p className="m-0 text-sm text-muted">Nothing yet. Salaries, taxes and share trades show up here.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
              {treasury.recent.map((movement) => (
                <li key={movement.id} className="flex items-center gap-3">
                  <GuildAvatar
                    name={movement.memberName ?? "?"}
                    iconUrl={movement.memberId ? memberAvatarUrl(movement.memberId, movement.memberAvatar) : null}
                    size={28}
                    className="border border-[#55555a] bg-selected"
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold">{describeMovement(movement.reason)}</span>
                    <span className="truncate text-[12.5px] text-muted">
                      {movement.memberName ?? (movement.memberId ? `Member …${movement.memberId.slice(-4)}` : "Server")}
                      {movement.note ? ` · ${movement.note}` : ""} · {timeAgo(new Date(movement.createdAt), now)}
                    </span>
                  </div>
                  <span className={`flex-none text-[13px] font-semibold ${movement.amount > 0 ? "text-fg" : "text-muted"}`} title={`${number(Math.abs(movement.amount))} ${unit}`}>
                    {signed(movement.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-col gap-px">
            <span className="font-display text-[17px] font-bold">Pay out</span>
            <span className="text-[12.5px] text-muted">Send coins from the treasury to a member. It is logged with your name.</span>
          </div>
          <PayOutForm guildId={guildId} balance={treasury.balance} unit={unit} />
        </div>
      </div>
    </Card>
  );
}

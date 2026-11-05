"use client";

import { useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Icon } from "@/components/ui/icon";
import { Locked } from "@/components/ui/locked";
import { MasterSwitch, PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { SettingRow } from "@/components/ui/setting-row";
import { Slider } from "@/components/ui/slider";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { Switch } from "@/components/ui/switch";

const ACTIONS = ["Quarantine", "Kick", "Ban"] as const;
type RaidAction = (typeof ACTIONS)[number];

// Sample history shown (locked) until Anti-Raid exists.
const HISTORY = [
  { when: "Oct 29, 21:14", joins: 38, window: "22 s", action: "Quarantine", dur: "6 min" },
  { when: "Oct 17, 03:52", joins: 24, window: "41 s", action: "Kick", dur: "3 min" },
  { when: "Oct 08, 18:05", joins: 61, window: "30 s", action: "Ban", dur: "11 min" },
  { when: "Oct 02, 12:40", joins: 19, window: "18 s", action: "Quarantine", dur: "2 min" },
] as const;

export function AntiRaidView() {
  const [enabled, setEnabled] = useState(true);
  const [joins, setJoins] = useState(10);
  const [secs, setSecs] = useState(30);
  const [age, setAge] = useState(7);
  const [action, setAction] = useState<RaidAction>("Quarantine");
  const [lock, setLock] = useState(true);
  const [notify, setNotify] = useState(true);
  const [verify, setVerify] = useState(false);

  const status = enabled
    ? { label: "No raid detected", color: "#4ade80" }
    : { label: "Not watching", color: "#fbbf24" };

  return (
    <>
      <PageHeader
        title="Anti-Raid"
        description="Detect coordinated joins and stop them before they reach your members."
        aside={
          <MasterSwitch label={enabled ? "Protection on" : "Protection off"}>
            <Locked feature="antiRaid" compact className="rounded-xl">
              <Switch label="Anti-Raid protection" checked={enabled} onChange={setEnabled} />
            </Locked>
          </MasterSwitch>
        }
      />

      <Locked feature="antiRaid" className="rounded-2xl">
        <StatGrid min={240}>
          <StatCard
            label="Raid status"
            valueClassName="!text-2xl"
            value={
              <span className="flex items-center gap-2" style={{ color: status.color }}>
                <Icon name="check" size={20} strokeWidth={1.9} />
                {status.label}
              </span>
            }
          />
          <StatCard label="Joins, last 10 min" value="14" sub="Below the trigger threshold" />
        </StatGrid>
      </Locked>

      <div className="flex flex-wrap gap-4">
        <Card lock="antiRaid" labelledBy="h-det" className="flex-[1_1_420px] gap-[18px] px-5 py-[18px]">
          <CardTitle id="h-det">Detection</CardTitle>
          <Slider label="Join burst" hint="Members joining within the window before a raid is declared" min={3} max={50} value={joins} shown={`${joins} joins`} onChange={setJoins} />
          <Slider label="Time window" hint="How long the burst is measured over" min={5} max={120} value={secs} shown={`${secs} seconds`} onChange={setSecs} />
          <Slider label="Minimum account age" hint="Younger accounts weigh double in the burst count" min={0} max={30} value={age} shown={`${age} days`} onChange={setAge} />
        </Card>

        <Card lock="antiRaid" labelledBy="h-resp" className="flex-[1_1_420px] gap-3.5 px-5 py-[18px]">
          <CardTitle id="h-resp">Response</CardTitle>
          <div className="flex flex-col gap-2">
            <span id="seg-l" className="text-[14.5px] font-semibold">
              Action on suspected raiders
            </span>
            <Segmented
              labelledBy="seg-l"
              options={ACTIONS.map((value) => ({ value, label: value }))}
              value={action}
              onChange={setAction}
            />
          </div>
          <SettingRow label="Lock channels during a raid" description="Members cannot send messages until the raid ends">
            <Switch label="Lock channels during a raid" checked={lock} onChange={setLock} />
          </SettingRow>
          <SettingRow label="Alert admins" description="Post a message in the log channel the moment a raid starts">
            <Switch label="Alert admins" checked={notify} onChange={setNotify} />
          </SettingRow>
          <SettingRow label="Raise verification level" description="Require a verified phone number while the raid lasts">
            <Switch label="Raise verification level" checked={verify} onChange={setVerify} />
          </SettingRow>
        </Card>
      </div>

      <Card lock="antiRaid" labelledBy="h-hist" className="gap-3 px-5 pt-[18px] pb-2">
        <CardTitle id="h-hist">Raid history</CardTitle>
        <DataTable cellPadding={14} head={["Detected", "Joins", "Window", "Action taken", "Duration"]}>
          {HISTORY.map((row) => (
            <tr key={row.when}>
              <td>{row.when}</td>
              <td>{row.joins}</td>
              <td>{row.window}</td>
              <td>{row.action}</td>
              <td>{row.dur}</td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </>
  );
}

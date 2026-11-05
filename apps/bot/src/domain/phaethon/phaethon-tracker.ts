import { dayOf } from "@/domain/activity/activity-tracker.ts";
import { MAX_TEXT_LENGTH } from "./phaethon-rules.ts";
import {
  EMPTY_PHAETHON_BATCH,
  type EdgeMetric,
  type EdgeSnapshot,
  type GameKind,
  type GameSnapshot,
  type IdentityEvent,
  type MemberHourSnapshot,
  type PhaethonBatch,
  type PresenceStatus,
  type StatusSnapshot,
} from "./phaethon-types.ts";

type EdgeDelta = Partial<Record<EdgeMetric, number>>;

/**
 * Tampon en mémoire de Phaéthon : relations entre membres, rythme horaire,
 * présence, jeux et changements d'identité. Comme `ActivityTracker`, il ne
 * garde que des deltas ; `drain()` les remet au service qui les écrit.
 */
export class PhaethonTracker {
  private edges = new Map<string, EdgeSnapshot>();
  private hours = new Map<string, MemberHourSnapshot>();
  private statuses = new Map<string, StatusSnapshot>();
  private games = new Map<string, GameSnapshot>();
  private identity = new Map<string, IdentityEvent>();

  /** Interaction dirigée `memberId → targetId`. Un membre n'interagit pas avec lui-même. */
  recordInteraction(
    guildId: string,
    memberId: string,
    targetId: string,
    at: Date,
    delta: EdgeDelta,
  ): void {
    if (memberId === targetId) {
      return;
    }

    const day = dayOf(at);
    const key = `${guildId}:${memberId}:${targetId}:${day}`;
    const current = this.edges.get(key) ?? {
      guildId,
      memberId,
      targetId,
      day,
      replies: 0,
      mentions: 0,
      reactions: 0,
      voiceSeconds: 0,
    };

    this.edges.set(key, {
      ...current,
      replies: current.replies + whole(delta.replies),
      mentions: current.mentions + whole(delta.mentions),
      reactions: current.reactions + whole(delta.reactions),
      voiceSeconds: current.voiceSeconds + whole(delta.voiceSeconds),
    });
  }

  /** Un message de `memberId` à l'heure UTC de `at` (jamais son contenu). */
  recordMessageHour(guildId: string, memberId: string, at: Date): void {
    const day = dayOf(at);
    const hour = at.getUTCHours();
    const key = `${guildId}:${memberId}:${day}:${hour}`;
    const current = this.hours.get(key) ?? { guildId, memberId, day, hour, messages: 0 };

    this.hours.set(key, { ...current, messages: current.messages + 1 });
  }

  recordStatusSeconds(
    guildId: string,
    memberId: string,
    status: PresenceStatus,
    seconds: number,
    at: Date,
  ): void {
    const amount = whole(seconds);

    if (amount <= 0) {
      return;
    }

    const day = dayOf(at);
    const key = `${guildId}:${memberId}:${day}:${status}`;
    const current = this.statuses.get(key) ?? { guildId, memberId, day, status, seconds: 0 };

    this.statuses.set(key, { ...current, seconds: current.seconds + amount });
  }

  recordGameSeconds(
    guildId: string,
    memberId: string,
    name: string,
    kind: GameKind,
    seconds: number,
    at: Date,
  ): void {
    const amount = whole(seconds);
    const label = name.trim().slice(0, MAX_TEXT_LENGTH);

    if (amount <= 0 || label === "") {
      return;
    }

    const day = dayOf(at);
    const key = `${guildId}:${memberId}:${day}:${kind}:${label}`;
    const current = this.games.get(key) ?? { guildId, memberId, day, name: label, kind, seconds: 0 };

    this.games.set(key, { ...current, seconds: current.seconds + amount });
  }

  recordIdentity(event: IdentityEvent): void {
    this.identity.set(event.id, {
      ...event,
      oldValue: clip(event.oldValue),
      newValue: clip(event.newValue),
    });
  }

  /** Oublie tout ce qui concerne un membre, comme source ou comme cible (droit à l'effacement). */
  forget(guildId: string, memberId: string): void {
    for (const [key, edge] of this.edges) {
      if (edge.guildId === guildId && (edge.memberId === memberId || edge.targetId === memberId)) {
        this.edges.delete(key);
      }
    }

    for (const map of [this.hours, this.statuses, this.games, this.identity] as Map<
      string,
      { guildId: string; memberId: string }
    >[]) {
      for (const [key, item] of map) {
        if (item.guildId === guildId && item.memberId === memberId) {
          map.delete(key);
        }
      }
    }
  }

  /** Retire et renvoie tout ce qui s'est accumulé. */
  drain(): PhaethonBatch {
    const batch: PhaethonBatch = {
      edges: [...this.edges.values()],
      hours: [...this.hours.values()],
      statuses: [...this.statuses.values()],
      games: [...this.games.values()],
      identity: [...this.identity.values()],
    };

    this.edges = new Map();
    this.hours = new Map();
    this.statuses = new Map();
    this.games = new Map();
    this.identity = new Map();

    return batch;
  }

  /** Réintègre un lot dont l'écriture a échoué. */
  restore(batch: PhaethonBatch = EMPTY_PHAETHON_BATCH): void {
    for (const edge of batch.edges) {
      this.recordInteraction(edge.guildId, edge.memberId, edge.targetId, new Date(`${edge.day}T00:00:00Z`), edge);
    }

    for (const row of batch.hours) {
      const key = `${row.guildId}:${row.memberId}:${row.day}:${row.hour}`;
      const current = this.hours.get(key);
      this.hours.set(key, current ? { ...current, messages: current.messages + row.messages } : row);
    }

    for (const row of batch.statuses) {
      this.recordStatusSeconds(row.guildId, row.memberId, row.status, row.seconds, new Date(`${row.day}T00:00:00Z`));
    }

    for (const row of batch.games) {
      this.recordGameSeconds(row.guildId, row.memberId, row.name, row.kind, row.seconds, new Date(`${row.day}T00:00:00Z`));
    }

    for (const event of batch.identity) {
      this.identity.set(event.id, event);
    }
  }
}

const whole = (value: number | undefined): number =>
  Number.isFinite(value) ? Math.max(0, Math.floor(value as number)) : 0;

const clip = (value: string | null): string | null =>
  value === null ? null : value.slice(0, MAX_TEXT_LENGTH * 4);

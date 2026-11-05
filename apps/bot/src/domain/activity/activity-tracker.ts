import {
  EMPTY_BATCH,
  type ActivityBatch,
  type ActivitySnapshot,
  type ChannelSnapshot,
  type HourlySnapshot,
  type PresenceDelta,
} from "./activity-types.ts";
import {
  EMPTY_COUNTERS,
  addCounters,
  countersWith,
  type Counters,
} from "./counters.ts";

/** Faits d'un message, sans son contenu : seules des tailles et des nombres passent ici. */
export type MessageFacts = Readonly<{
  characters: number;
  isReply: boolean;
  attachments: number;
  mentions: number;
}>;

/**
 * Tampon en mémoire des compteurs d'activité. Il ne stocke que des deltas :
 * `drain()` les remet au service, qui les écrit dans les stores. La classe
 * ignore Discord et SQL.
 */
export class ActivityTracker {
  private daily = new Map<string, ActivitySnapshot>();
  private channels = new Map<string, ChannelSnapshot>();
  private hourly = new Map<string, HourlySnapshot>();
  private presences = new Map<string, PresenceDelta>();

  recordMessage(
    guildId: string,
    memberId: string,
    channelId: string,
    at: Date,
    facts: MessageFacts,
  ): void {
    this.add(
      guildId,
      memberId,
      at,
      countersWith({
        messages: 1,
        characters: Math.max(0, Math.floor(facts.characters)),
        replies: facts.isReply ? 1 : 0,
        attachments: Math.max(0, Math.floor(facts.attachments)),
        mentions: Math.max(0, Math.floor(facts.mentions)),
      }),
    );
    this.addChannel(guildId, memberId, channelId, at, { messages: 1, voiceSeconds: 0 });
    this.addHour(guildId, at);
    this.touch(guildId, memberId, at);
  }

  /** Réaction ajoutée par `memberId` (compte comme une activité). */
  recordReactionGiven(guildId: string, memberId: string, at: Date): void {
    this.add(guildId, memberId, at, countersWith({ reactionsGiven: 1 }));
    this.touch(guildId, memberId, at);
  }

  /** Réaction reçue par l'auteur du message (n'est pas une activité de sa part). */
  recordReactionReceived(guildId: string, authorId: string, at: Date): void {
    this.add(guildId, authorId, at, countersWith({ reactionsReceived: 1 }));
  }

  recordVoiceSeconds(
    guildId: string,
    memberId: string,
    channelId: string,
    seconds: number,
    at: Date,
  ): void {
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return;
    }

    const whole = Math.floor(seconds);
    this.add(guildId, memberId, at, countersWith({ voiceSeconds: whole }));
    this.addChannel(guildId, memberId, channelId, at, {
      messages: 0,
      voiceSeconds: whole,
    });
    this.touch(guildId, memberId, at);
  }

  recordJoin(guildId: string, memberId: string, at: Date): void {
    this.add(guildId, memberId, at, countersWith({ joins: 1 }));
  }

  recordLeave(guildId: string, memberId: string, at: Date): void {
    this.add(guildId, memberId, at, countersWith({ leaves: 1 }));
  }

  recordInviteAttribution(guildId: string, memberId: string, at: Date): void {
    this.add(guildId, memberId, at, countersWith({ attributedInvites: 1 }));
  }

  /** Deltas non encore écrits pour un membre. */
  pendingForMember(
    guildId: string,
    memberId: string,
  ): readonly ActivitySnapshot[] {
    return [...this.daily.values()].filter(
      (snapshot) =>
        snapshot.guildId === guildId && snapshot.memberId === memberId,
    );
  }

  /** Oublie tout ce qui est en attente pour un membre (droit à l'effacement). */
  forget(guildId: string, memberId: string): void {
    const concerned = (item: { guildId: string; memberId: string }) =>
      item.guildId === guildId && item.memberId === memberId;

    for (const [key, item] of this.daily) if (concerned(item)) this.daily.delete(key);
    for (const [key, item] of this.channels) if (concerned(item)) this.channels.delete(key);
    for (const [key, item] of this.presences) if (concerned(item)) this.presences.delete(key);
  }

  list(): readonly ActivitySnapshot[] {
    return [...this.daily.values()];
  }

  /** Retire et renvoie tout ce qui s'est accumulé. */
  drain(): ActivityBatch {
    const batch: ActivityBatch = {
      daily: [...this.daily.values()],
      channels: [...this.channels.values()],
      hourly: [...this.hourly.values()],
      presences: [...this.presences.values()],
    };

    this.daily = new Map();
    this.channels = new Map();
    this.hourly = new Map();
    this.presences = new Map();

    return batch;
  }

  /** Réintègre un lot dont l'écriture a échoué. */
  restore(batch: ActivityBatch = EMPTY_BATCH): void {
    for (const snapshot of batch.daily) {
      const key = dailyKey(snapshot.guildId, snapshot.memberId, snapshot.day);
      const current = this.daily.get(key);
      this.daily.set(key, current ? mergeDaily(current, snapshot) : snapshot);
    }

    for (const snapshot of batch.channels) {
      const key = channelKey(snapshot);
      const current = this.channels.get(key);
      this.channels.set(
        key,
        current
          ? {
              ...current,
              messages: current.messages + snapshot.messages,
              voiceSeconds: current.voiceSeconds + snapshot.voiceSeconds,
            }
          : snapshot,
      );
    }

    for (const snapshot of batch.hourly) {
      const key = hourlyKey(snapshot.guildId, snapshot.day, snapshot.hour);
      const current = this.hourly.get(key);
      this.hourly.set(
        key,
        current ? { ...current, messages: current.messages + snapshot.messages } : snapshot,
      );
    }

    for (const presence of batch.presences) {
      this.keepLatest(presence);
    }
  }

  private add(guildId: string, memberId: string, at: Date, delta: Counters): void {
    const day = dayOf(at);
    const key = dailyKey(guildId, memberId, day);
    const current = this.daily.get(key) ?? { guildId, memberId, day, ...EMPTY_COUNTERS };

    this.daily.set(key, { ...current, ...addCounters(current, delta) });
  }

  private addChannel(
    guildId: string,
    memberId: string,
    channelId: string,
    at: Date,
    delta: Readonly<{ messages: number; voiceSeconds: number }>,
  ): void {
    const day = dayOf(at);
    const base: ChannelSnapshot = {
      guildId,
      memberId,
      channelId,
      day,
      messages: 0,
      voiceSeconds: 0,
    };
    const key = channelKey(base);
    const current = this.channels.get(key) ?? base;

    this.channels.set(key, {
      ...current,
      messages: current.messages + delta.messages,
      voiceSeconds: current.voiceSeconds + delta.voiceSeconds,
    });
  }

  private addHour(guildId: string, at: Date): void {
    const day = dayOf(at);
    const hour = at.getUTCHours();
    const key = hourlyKey(guildId, day, hour);
    const current = this.hourly.get(key) ?? { guildId, day, hour, messages: 0 };

    this.hourly.set(key, { ...current, messages: current.messages + 1 });
  }

  private touch(guildId: string, memberId: string, at: Date): void {
    this.keepLatest({ guildId, memberId, at });
  }

  private keepLatest(presence: PresenceDelta): void {
    const key = `${presence.guildId}:${presence.memberId}`;
    const current = this.presences.get(key);

    if (!current || current.at.getTime() < presence.at.getTime()) {
      this.presences.set(key, presence);
    }
  }
}

export function dayOf(at: Date): string {
  return at.toISOString().slice(0, 10);
}

function mergeDaily(left: ActivitySnapshot, right: ActivitySnapshot): ActivitySnapshot {
  return { ...left, ...addCounters(left, right) };
}

function dailyKey(guildId: string, memberId: string, day: string): string {
  return `${guildId}:${memberId}:${day}`;
}

function channelKey(snapshot: ChannelSnapshot): string {
  return `${snapshot.guildId}:${snapshot.memberId}:${snapshot.channelId}:${snapshot.day}`;
}

function hourlyKey(guildId: string, day: string, hour: number): string {
  return `${guildId}:${day}:${hour}`;
}


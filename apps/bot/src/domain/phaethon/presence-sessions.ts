import type { GameKind, PresenceStatus } from "./phaethon-types.ts";

export type ObservedGame = Readonly<{ name: string; kind: GameKind }>;

/** Ce que Discord dit d'un membre à un instant : son statut et ses activités. `offline` n'est pas conservé. */
export type ObservedPresence = Readonly<{
  status: PresenceStatus | "offline";
  games: readonly ObservedGame[];
}>;

export type PresenceSink = Readonly<{
  status: (guildId: string, memberId: string, status: PresenceStatus, seconds: number, at: Date) => void;
  game: (
    guildId: string,
    memberId: string,
    name: string,
    kind: GameKind,
    seconds: number,
    at: Date,
  ) => void;
}>;

type Session = {
  guildId: string;
  memberId: string;
  startedAt: Date;
  status: PresenceStatus;
  games: readonly ObservedGame[];
};

/**
 * Convertit les changements de présence en durées : combien de temps un membre
 * est resté « en ligne », « absent » ou « ne pas déranger », et à quoi il jouait.
 * Aucune dépendance à Discord : l'adaptateur traduit les présences.
 */
export class PresenceSessions {
  private readonly sessions = new Map<string, Session>();

  constructor(private readonly sink: PresenceSink) {}

  get activeCount(): number {
    return this.sessions.size;
  }

  /** Crédite la session en cours puis la remplace par le nouvel état (ou la ferme si hors ligne). */
  observe(guildId: string, memberId: string, observed: ObservedPresence, at: Date): void {
    const key = keyOf(guildId, memberId);
    const current = this.sessions.get(key);

    if (current) {
      this.credit(current, at);
    }

    if (observed.status === "offline") {
      this.sessions.delete(key);
      return;
    }

    this.sessions.set(key, {
      guildId,
      memberId,
      startedAt: at,
      status: observed.status,
      games: observed.games,
    });
  }

  /** Crédite le temps écoulé sans fermer les sessions : un arrêt brutal ne perd qu'un intervalle. */
  checkpoint(at: Date): void {
    for (const session of this.sessions.values()) {
      this.credit(session, at);
    }
  }

  closeAll(at: Date): void {
    this.checkpoint(at);
    this.sessions.clear();
  }

  /** Remplace les sessions par l'état réel (démarrage / reconnexion). */
  hydrate(
    members: readonly { guildId: string; memberId: string; observed: ObservedPresence }[],
    at: Date,
  ): void {
    this.sessions.clear();

    for (const { guildId, memberId, observed } of members) {
      if (observed.status !== "offline") {
        this.sessions.set(keyOf(guildId, memberId), {
          guildId,
          memberId,
          startedAt: at,
          status: observed.status,
          games: observed.games,
        });
      }
    }
  }

  forget(guildId: string, memberId: string): void {
    this.sessions.delete(keyOf(guildId, memberId));
  }

  private credit(session: Session, at: Date): void {
    const seconds = Math.floor((at.getTime() - session.startedAt.getTime()) / 1_000);

    if (seconds <= 0) {
      return;
    }

    this.sink.status(session.guildId, session.memberId, session.status, seconds, at);

    for (const game of session.games) {
      this.sink.game(session.guildId, session.memberId, game.name, game.kind, seconds, at);
    }

    session.startedAt = new Date(session.startedAt.getTime() + seconds * 1_000);
  }
}

const keyOf = (guildId: string, memberId: string) => `${guildId}:${memberId}`;

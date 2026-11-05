type ActiveVoiceSession = {
  guildId: string;
  memberId: string;
  channelId: string;
  startedAt: Date;
};

export type VoiceDurationSink = (
  guildId: string,
  memberId: string,
  channelId: string,
  seconds: number,
  at: Date,
) => void;

/**
 * Convertit des entrées, déplacements et sorties vocales en durées par salon.
 * Aucune dépendance à Discord : l'adaptateur traduit les `VoiceState`.
 */
export class VoiceSessionTracker {
  private readonly sessions = new Map<string, ActiveVoiceSession>();

  constructor(private readonly sink: VoiceDurationSink) {}

  get activeCount(): number {
    return this.sessions.size;
  }

  /** Démarre une session ; sans effet si elle est déjà ouverte (préserve son début). */
  join(guildId: string, memberId: string, channelId: string, at: Date): void {
    const key = keyOf(guildId, memberId);

    if (!this.sessions.has(key)) {
      this.sessions.set(key, { guildId, memberId, channelId, startedAt: at });
    }
  }

  /** Passage d'un salon à un autre : crédite l'ancien salon puis démarre le nouveau. */
  move(guildId: string, memberId: string, channelId: string, at: Date): void {
    const key = keyOf(guildId, memberId);
    const session = this.sessions.get(key);

    if (!session) {
      this.join(guildId, memberId, channelId, at);
      return;
    }

    if (session.channelId === channelId) {
      return;
    }

    this.credit(session, at);
    session.channelId = channelId;
    session.startedAt = at;
  }

  leave(guildId: string, memberId: string, at: Date): void {
    const key = keyOf(guildId, memberId);
    const session = this.sessions.get(key);

    if (!session) {
      return;
    }

    this.sessions.delete(key);
    this.credit(session, at);
  }

  /**
   * Crédite le temps déjà écoulé des sessions ouvertes sans les fermer :
   * un arrêt brutal ne perd plus que l'intervalle depuis le dernier point.
   */
  checkpoint(at: Date): void {
    for (const session of this.sessions.values()) {
      this.credit(session, at);
    }
  }

  /** Ferme et crédite toutes les sessions (arrêt propre). */
  closeAll(at: Date): void {
    for (const session of this.sessions.values()) {
      this.credit(session, at);
    }

    this.sessions.clear();
  }

  /** Remplace les sessions par l'état vocal réel (démarrage / reconnexion). */
  hydrate(
    members: readonly { guildId: string; memberId: string; channelId: string }[],
    at: Date,
  ): void {
    this.sessions.clear();

    for (const { guildId, memberId, channelId } of members) {
      this.sessions.set(keyOf(guildId, memberId), {
        guildId,
        memberId,
        channelId,
        startedAt: at,
      });
    }
  }

  private credit(session: ActiveVoiceSession, at: Date): void {
    const seconds = Math.floor(
      (at.getTime() - session.startedAt.getTime()) / 1_000,
    );

    if (seconds <= 0) {
      return;
    }

    this.sink(session.guildId, session.memberId, session.channelId, seconds, at);
    // On n'avance que de la partie entière pour ne perdre aucune fraction de seconde.
    session.startedAt = new Date(session.startedAt.getTime() + seconds * 1_000);
  }
}

function keyOf(guildId: string, memberId: string): string {
  return `${guildId}:${memberId}`;
}

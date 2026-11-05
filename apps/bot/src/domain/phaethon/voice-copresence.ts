export type PairSink = (
  guildId: string,
  memberId: string,
  otherId: string,
  seconds: number,
  at: Date,
) => void;

type Channel = {
  guildId: string;
  members: Set<string>;
  lastTick: Date;
};

/**
 * Qui est en vocal avec qui. À chaque entrée, sortie ou point de contrôle, le
 * temps écoulé depuis le dernier repère est crédité à chaque paire présente
 * dans le salon (dans les deux sens). Les salons trop peuplés sont ignorés.
 */
export class VoiceCoPresence {
  private readonly channels = new Map<string, Channel>();
  private readonly where = new Map<string, string>();

  constructor(
    private readonly sink: PairSink,
    private readonly maxChannelSize: number,
  ) {}

  join(guildId: string, memberId: string, channelId: string, at: Date): void {
    const key = memberKey(guildId, memberId);

    if (this.where.get(key) === channelId) {
      return;
    }

    this.leave(guildId, memberId, at);

    const channel = this.channel(guildId, channelId, at);
    this.tick(channel, at);
    channel.members.add(memberId);
    this.where.set(key, channelId);
  }

  move(guildId: string, memberId: string, channelId: string, at: Date): void {
    this.join(guildId, memberId, channelId, at);
  }

  leave(guildId: string, memberId: string, at: Date): void {
    const key = memberKey(guildId, memberId);
    const channelId = this.where.get(key);

    if (channelId === undefined) {
      return;
    }

    const channel = this.channels.get(channelKey(guildId, channelId));
    this.where.delete(key);

    if (!channel) {
      return;
    }

    this.tick(channel, at);
    channel.members.delete(memberId);

    if (channel.members.size === 0) {
      this.channels.delete(channelKey(guildId, channelId));
    }
  }

  checkpoint(at: Date): void {
    for (const channel of this.channels.values()) {
      this.tick(channel, at);
    }
  }

  closeAll(at: Date): void {
    this.checkpoint(at);
    this.channels.clear();
    this.where.clear();
  }

  /** Remplace l'état par la réalité (démarrage / reconnexion). */
  hydrate(
    members: readonly { guildId: string; memberId: string; channelId: string }[],
    at: Date,
  ): void {
    this.channels.clear();
    this.where.clear();

    for (const { guildId, memberId, channelId } of members) {
      this.channel(guildId, channelId, at).members.add(memberId);
      this.where.set(memberKey(guildId, memberId), channelId);
    }
  }

  private channel(guildId: string, channelId: string, at: Date): Channel {
    const key = channelKey(guildId, channelId);
    const existing = this.channels.get(key);

    if (existing) {
      return existing;
    }

    const created: Channel = { guildId, members: new Set(), lastTick: at };
    this.channels.set(key, created);

    return created;
  }

  private tick(channel: Channel, at: Date): void {
    const size = channel.members.size;

    if (size < 2 || size > this.maxChannelSize) {
      channel.lastTick = at;
      return;
    }

    const seconds = Math.floor((at.getTime() - channel.lastTick.getTime()) / 1_000);

    if (seconds <= 0) {
      return;
    }

    const members = [...channel.members];

    for (const memberId of members) {
      for (const otherId of members) {
        if (memberId !== otherId) {
          this.sink(channel.guildId, memberId, otherId, seconds, at);
        }
      }
    }

    // On n'avance que de la partie entière pour ne perdre aucune fraction de seconde.
    channel.lastTick = new Date(channel.lastTick.getTime() + seconds * 1_000);
  }
}

const memberKey = (guildId: string, memberId: string) => `${guildId}:${memberId}`;
const channelKey = (guildId: string, channelId: string) => `${guildId}:${channelId}`;

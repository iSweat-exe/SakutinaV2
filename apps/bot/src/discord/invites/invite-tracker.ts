import type { Guild } from "discord.js";

import {
  attributeInvite,
  type InviteAttribution,
  type InviteState,
} from "@/domain/invites/invite-attribution.ts";

/**
 * Conserve un instantané des utilisations d'invitations pour attribuer les
 * arrivées. Les arrivées sont traitées une par une : deux arrivées simultanées
 * ne partagent jamais le même instantané.
 */
export class InviteTracker {
  private readonly stateByGuild = new Map<string, Map<string, InviteState>>();
  private queue: Promise<unknown> = Promise.resolve();

  async initialise(guild: Guild): Promise<void> {
    this.stateByGuild.set(guild.id, await this.read(guild));
  }

  attributeJoin(guild: Guild): Promise<InviteAttribution | null> {
    const run = this.queue.then(() => this.attribute(guild));
    this.queue = run.catch(() => undefined);

    return run;
  }

  private async attribute(guild: Guild): Promise<InviteAttribution | null> {
    const previousState = this.stateByGuild.get(guild.id) ?? new Map();
    const current = await this.read(guild);
    this.stateByGuild.set(guild.id, current);

    const previousUses = new Map(
      [...previousState].map(([code, state]) => [code, state.uses]),
    );

    return attributeInvite(previousUses, current, previousState);
  }

  private async read(guild: Guild): Promise<Map<string, InviteState>> {
    const invites = await guild.invites.fetch();

    return new Map(
      invites.map((invite) => [
        invite.code,
        { uses: invite.uses ?? 0, inviterId: invite.inviterId },
      ]),
    );
  }
}

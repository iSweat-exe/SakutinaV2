/** Un avertissement donné à un membre. Le numéro sert à le retirer (`/mod unwarn`). */
export type Warning = Readonly<{
  id: number;
  guildId: string;
  memberId: string;
  moderatorId: string;
  reason: string;
  createdAt: Date;
}>;

export type NewWarning = Omit<Warning, "id">;

/** Pourquoi une sanction est refusée avant même d'être tentée. */
export type Refusal =
  | "self"
  | "bot"
  | "owner"
  | "role"
  | "position"
  | "bot-position";

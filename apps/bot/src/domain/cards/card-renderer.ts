export type CardStat = Readonly<{ label: string; value: string }>;

export type ProfileCardInput = Readonly<{
  title: string;
  subtitle?: string;
  /** Couleur d'accent `#RRGGBB`. */
  accent?: string;
  /** Avatar encodé (PNG, JPEG, WebP) ; un avatar illisible est remplacé. */
  avatar?: Uint8Array;
  /** Entre 1 et 6 statistiques déjà formatées. */
  stats: readonly CardStat[];
}>;

/** Génère une image PNG de carte de profil. */
export interface CardRenderer {
  render(input: ProfileCardInput): Promise<Uint8Array>;
}

import { createRequire } from "node:module";

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

/** Fonctions exposées par `src/lib.rs`. */
export interface NativeAddon {
  /** Dessine une carte PNG hors du thread principal. */
  renderProfileCard(input: ProfileCardInput): Promise<Uint8Array>;
}

export type NativeLoadResult =
  | Readonly<{ ok: true; addon: NativeAddon }>
  | Readonly<{ ok: false; reason: string }>;

/**
 * Charge l'addon compilé (`bun run native:build`). Ne lève jamais : un bot sans
 * addon (non compilé, plateforme non supportée) continue de fonctionner sans
 * les fonctions qui en dépendent.
 */
export function loadNativeAddon(): NativeLoadResult {
  try {
    const require = createRequire(import.meta.url);
    const addon = require("./dist/sakutina_native.node") as NativeAddon;

    return { ok: true, addon };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

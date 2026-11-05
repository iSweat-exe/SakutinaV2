import { loadNativeAddon } from "@sakutina/native";

import type { CardRenderer } from "@/domain/cards/card-renderer.ts";
import { logger } from "@/shared/logger.ts";

/**
 * Branche l'addon Rust sur l'interface `CardRenderer`. Renvoie `null` si
 * l'addon n'est pas compilé : les commandes d'image sont alors désactivées.
 */
export function createCardRenderer(): CardRenderer | null {
  const native = loadNativeAddon();

  if (!native.ok) {
    logger.warn("Native addon unavailable: image commands are disabled", {
      reason: native.reason,
    });
    return null;
  }

  return { render: (input) => native.addon.renderProfileCard(input) };
}

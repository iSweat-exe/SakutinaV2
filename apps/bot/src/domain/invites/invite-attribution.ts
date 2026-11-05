export type InviteState = Readonly<{
  uses: number;
  inviterId: string | null;
}>;

export type InviteAttribution = Readonly<{
  code: string;
  inviterId: string | null;
}>;

/**
 * Déduit l'invitation utilisée en comparant deux instantanés.
 *
 * - Une seule invitation dont `uses` a augmenté → attribuée.
 * - Aucune n'a augmenté mais une seule a disparu (invitation à usage unique
 *   consommée) → attribuée.
 * - Sinon (plusieurs candidats ou aucun) → `null` : on préfère ne pas
 *   attribuer plutôt que mal attribuer.
 */
export function attributeInvite(
  previous: ReadonlyMap<string, number>,
  current: ReadonlyMap<string, InviteState>,
  lastKnown: ReadonlyMap<string, InviteState> = new Map(),
): InviteAttribution | null {
  const increased = [...current].filter(
    ([code, state]) => state.uses > (previous.get(code) ?? 0),
  );

  if (increased.length === 1) {
    const [code, state] = increased[0]!;
    return { code, inviterId: state.inviterId };
  }

  if (increased.length > 1) {
    return null;
  }

  const vanished = [...previous.keys()].filter((code) => !current.has(code));

  if (vanished.length === 1) {
    const code = vanished[0]!;
    return { code, inviterId: lastKnown.get(code)?.inviterId ?? null };
  }

  return null;
}

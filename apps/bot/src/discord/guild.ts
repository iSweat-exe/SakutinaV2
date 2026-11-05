/**
 * Le serveur d'une interaction. Le routeur (`events/interaction-create.ts`) refuse déjà toute
 * interaction hors serveur : l'absence d'identifiant ici est une erreur de programmation.
 */
export function guildIdOf(interaction: Readonly<{ guildId: string | null }>): string {
  if (!interaction.guildId) {
    throw new Error("Interaction outside a guild reached a guild handler");
  }

  return interaction.guildId;
}

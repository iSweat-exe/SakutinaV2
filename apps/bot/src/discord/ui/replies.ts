import {
  MessageFlags,
  type SendableChannels,
  type AttachmentBuilder,
  type ChatInputCommandInteraction,
  type MessageComponentInteraction,
  type ModalSubmitInteraction,
} from "discord.js";

import type { Panel } from "@/discord/ui/panels.ts";

/** Toute interaction à laquelle le bot peut répondre : commande, composant ou modale. */
export type Repliable =
  | ChatInputCommandInteraction
  | MessageComponentInteraction
  | ModalSubmitInteraction;

type RespondOptions = Readonly<{
  /** Visible uniquement par l'auteur de la commande. */
  ephemeral?: boolean;
  files?: readonly AttachmentBuilder[];
}>;

/**
 * Seul point d'envoi des réponses : toute réponse du bot est un panneau V2.
 * Gère seul les trois états d'une interaction (neuve, différée, déjà répondue).
 */
export async function respond(
  interaction: Repliable,
  panel: Panel,
  { ephemeral = false, files = [] }: RespondOptions = {},
): Promise<void> {
  const components = [...panel.components];
  const attachments = [...files];

  if (interaction.deferred) {
    // Le caractère privé d'une réponse différée est fixé au moment de `deferReply`.
    await interaction.editReply({ components, flags: MessageFlags.IsComponentsV2, files: attachments });
    return;
  }

  const payload = ephemeral
    ? { components, files: attachments, flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral }
    : { components, files: attachments, flags: MessageFlags.IsComponentsV2 };

  if (interaction.replied) {
    await interaction.followUp(payload);
  } else {
    await interaction.reply(payload);
  }
}

/** Une erreur n'est jamais publique : elle ne concerne que celui qui l'a provoquée. */
export function respondPrivately(
  interaction: Repliable,
  panel: Panel,
): Promise<void> {
  return respond(interaction, panel, { ephemeral: true });
}

/** Remplace le message qui porte le contrôle utilisé (boutons, menus) : c'est ainsi qu'on « navigue ». */
export async function update(
  interaction: MessageComponentInteraction | ModalSubmitInteraction,
  panel: Panel,
): Promise<void> {
  if (interaction.isModalSubmit() && !interaction.isFromMessage()) {
    await respond(interaction, panel);
    return;
  }

  await interaction.update({
    components: [...panel.components],
    flags: MessageFlags.IsComponentsV2,
  });
}

/** Publie un panneau dans un salon, sans jamais mentionner personne (les `<@id>` du texte restent inertes). */
export async function post(channel: SendableChannels, panel: Panel): Promise<void> {
  await channel.send({
    components: [...panel.components],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] },
  });
}

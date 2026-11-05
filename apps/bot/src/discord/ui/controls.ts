import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type MessageActionRowComponentBuilder,
} from "discord.js";

/** Contrôles interactifs : un style de bouton par intention, jamais choisi à la main. */
export type Intent = "primary" | "neutral" | "success" | "danger";

const styles: Readonly<Record<Intent, ButtonStyle>> = {
  primary: ButtonStyle.Primary,
  neutral: ButtonStyle.Secondary,
  success: ButtonStyle.Success,
  danger: ButtonStyle.Danger,
};

export function button(options: {
  id: string;
  label: string;
  intent?: Intent;
  emoji?: string;
  disabled?: boolean;
}): ButtonBuilder {
  const builder = new ButtonBuilder()
    .setCustomId(options.id)
    .setLabel(options.label)
    .setStyle(styles[options.intent ?? "neutral"])
    .setDisabled(options.disabled ?? false);

  if (options.emoji) builder.setEmoji(options.emoji);

  return builder;
}

/** Une rangée de boutons (5 au plus). */
export function buttonRow(
  ...buttons: readonly ButtonBuilder[]
): ActionRowBuilder<MessageActionRowComponentBuilder> {
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(...buttons);
}

export type SelectOption = Readonly<{
  label: string;
  value: string;
  description?: string;
  emoji?: string;
  selected?: boolean;
}>;

/** Une rangée contenant un menu de choix unique (25 options au plus). */
export function selectRow(options: {
  id: string;
  placeholder: string;
  options: readonly SelectOption[];
}): ActionRowBuilder<MessageActionRowComponentBuilder> {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(options.id)
    .setPlaceholder(options.placeholder)
    .addOptions(
      options.options.map((option) => {
        const item = new StringSelectMenuOptionBuilder()
          .setLabel(option.label)
          .setValue(option.value)
          .setDefault(option.selected ?? false);

        if (option.description) item.setDescription(option.description);
        if (option.emoji) item.setEmoji(option.emoji);

        return item;
      }),
    );

  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(menu);
}

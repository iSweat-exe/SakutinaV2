import { discordTime, formatHour, formatNumber, formatVoiceTime, plain } from "@/discord/formatting.ts";
import { messages } from "@/discord/messages.ts";
import { bullets, lines, stat, statLine } from "@/discord/ui/blocks.ts";
import { createPanel, type Panel } from "@/discord/ui/panels.ts";
import type { Dossier, IdentityEvent } from "@/domain/phaethon/phaethon-types.ts";

/** Ce que Discord dit du membre à l'instant de la consultation (le reste vient de la base). */
export type LiveIdentity = Readonly<{
  username: string;
  displayName: string;
  avatarUrl: string;
  createdAt: Date;
  isBot: boolean;
  /** Rôles actuels, du plus haut au plus bas ; `@everyone` exclu. */
  roleIds: readonly string[];
  premiumSince: Date | null;
  timeoutUntil: Date | null;
}>;

const MAX_ROLES = 8;
const MAX_CONTACTS = 5;
const MAX_LIST = 5;

const id = (kind: "<@" | "<#", value: string) => `${kind}${value}>`;

/** Une ligne de la chronologie d'identité. */
export function describeIdentityEvent(event: IdentityEvent): string {
  const text = messages.phaethon.identity;
  const show = (value: string | null) => (value ? `« ${plain(value)} »` : text.unset);

  switch (event.kind) {
    case "nickname":
      return text.nickname(show(event.oldValue), show(event.newValue));
    case "username":
      return text.username(show(event.oldValue), show(event.newValue));
    case "display-name":
      return text["display-name"](show(event.oldValue), show(event.newValue));
    case "avatar":
      return text.avatar();
    case "roles":
      return text.roles(
        (event.newValue ?? "")
          .split(",")
          .filter((part) => part.length > 1)
          .map((part) => `${part[0]}<@&${part.slice(1)}>`)
          .join(" "),
      );
    case "boost":
      return text.boost(event.newValue !== null);
    case "timeout":
      return text.timeout(event.newValue !== null);
  }
}

function peakHours(hours: readonly number[]): string {
  return hours
    .map((value, hour) => ({ hour, value }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value || a.hour - b.hour)
    .slice(0, 3)
    .map((entry) => formatHour(entry.hour))
    .join(" · ");
}

/**
 * Le dossier d'un membre : tout ce que le bot sait de lui, en un seul panneau.
 * Le nom et l'avatar n'apparaissent pas quand le demandeur consulte son propre dossier.
 */
export function buildDossierPanel(dossier: Dossier, live: LiveIdentity, showIdentity: boolean): Panel {
  const text = messages.phaethon.profile;
  const { sections } = text;
  const { totals, profile } = dossier;
  const n = formatNumber;
  const roles = live.roleIds.slice(0, MAX_ROLES).map((role) => `<@&${role}>`);
  const extraRoles = live.roleIds.length - roles.length;

  const identity = lines(
    ...(showIdentity ? [`${text.name} **${plain(live.displayName)}** · ${plain(live.username)}`] : [`${text.name} ${plain(live.username)}`]),
    statLine(
      `${text.created} ${discordTime(live.createdAt)}`,
      profile?.joinedAt ? `${text.joined} ${discordTime(profile.joinedAt)}` : "",
    ).replace(/\s+·\s+$/, ""),
    ...(profile?.leftAt ? [`${text.left} ${discordTime(profile.leftAt)}`] : []),
    `${text.lastActive} ${profile?.lastActiveAt ? discordTime(profile.lastActiveAt, "R") : text.neverActive}`,
    `${text.roles} ${roles.length ? `${roles.join(" ")}${extraRoles > 0 ? ` +${extraRoles}` : ""}` : text.noRoles}`,
    ...(live.premiumSince ? [`${text.boost} ${discordTime(live.premiumSince)}`] : []),
    ...(live.timeoutUntil && live.timeoutUntil.getTime() > Date.now()
      ? [`${text.timeout} ${discordTime(live.timeoutUntil, "R")}`]
      : []),
    ...(live.isBot ? [text.bot] : []),
  );

  const activity = lines(
    statLine(
      stat(n(totals.messages), "messages"),
      stat(n(totals.characters), "caractères"),
      stat(n(totals.replies), "réponses"),
    ),
    statLine(
      stat(n(totals.attachments), "pièces jointes"),
      stat(n(totals.mentions), "mentions"),
      stat(n(totals.reactionsGiven), "réactions données"),
      stat(n(totals.reactionsReceived), "reçues"),
    ),
    statLine(`${text.voice} **${formatVoiceTime(totals.voiceSeconds)}**`),
  );

  const rhythm = dossier.hours.some((value) => value > 0)
    ? statLine(
        `${text.peakHours} (UTC) **${peakHours(dossier.hours)}**`,
        `${text.nightShare} **${Math.round(dossier.nightShare * 100)} %**`,
      )
    : text.noRhythm;

  const channelLines = [
    ...dossier.textChannels.slice(0, 3).map((row) => `${text.text} ${id("<#", row.channelId)} **${n(row.value)}**`),
    ...dossier.voiceChannels
      .slice(0, 3)
      .map((row) => `${text.voice} ${id("<#", row.channelId)} **${formatVoiceTime(row.value)}**`),
  ];

  const relations = dossier.contacts.slice(0, MAX_CONTACTS).map((contact) => {
    const sent = contact.sent.replies + contact.sent.mentions + contact.sent.reactions;
    const received = contact.received.replies + contact.received.mentions + contact.received.reactions;

    return `${id("<@", contact.otherId)} — ${text.contact(sent, received, contact.voiceSeconds > 0 ? formatVoiceTime(contact.voiceSeconds) : "")}`;
  });

  const { presence } = dossier;
  const presenceLine =
    presence.online + presence.idle + presence.dnd > 0
      ? statLine(
          `${text.statuses.online} **${formatVoiceTime(presence.online)}**`,
          `${text.statuses.idle} **${formatVoiceTime(presence.idle)}**`,
          `${text.statuses.dnd} **${formatVoiceTime(presence.dnd)}**`,
        )
      : text.presenceOff;

  const games = dossier.games
    .slice(0, MAX_LIST)
    .map((game) => `${text.kinds[game.kind]} ${plain(game.name)} **${formatVoiceTime(game.seconds)}**`);

  const timeline = dossier.identity
    .slice(0, MAX_LIST)
    .map((event) => `${discordTime(event.at, "R")} ${describeIdentityEvent(event)}`);

  const monthly = dossier.monthly.map((month) =>
    text.monthLine(month.month, n(month.messages), formatVoiceTime(month.voiceSeconds), month.activeDays),
  );

  const tagLines = dossier.tags.map((tag) => messages.tracking.tags[tag.id](tag.measured, tag.threshold));
  const section = (name: string, value: string | undefined) => ({ name, value: value || text.none });

  return createPanel({
    category: "tracking",
    title: text.title,
    ...(showIdentity ? { author: { name: live.displayName }, thumbnail: live.avatarUrl } : {}),
    fields: [
      section(sections.identity, identity),
      section(sections.activity, activity),
      section(sections.rhythm, rhythm),
      section(sections.channels, channelLines.join("\n")),
      section(sections.relations, relations.join("\n")),
      section(sections.presence, presenceLine),
      ...(games.length ? [section(sections.games, games.join("\n"))] : []),
      ...(timeline.length ? [section(sections.timeline, timeline.join("\n"))] : []),
      ...(monthly.length ? [section(sections.monthly, monthly.join("\n"))] : []),
      section(sections.tags, tagLines.length ? bullets(tagLines) : messages.tracking.stats.noTags),
    ],
    footer: text.footer(dossier.days),
    timestamp: true,
  });
}

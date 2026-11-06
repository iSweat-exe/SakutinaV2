/**
 * Texts of the landing page, in English and French. The rest of the panel is in
 * English only; the landing page speaks to future users, so it follows their language.
 */
export type Lang = "en" | "fr";

export const LANGS: readonly Lang[] = ["en", "fr"];

export const LANG_NAMES: Record<Lang, string> = { en: "English", fr: "Français" };

const en = {
  navSec: "Security",
  navPh: "Phaethon",
  navEco: "Economy",
  navCom: "Community",
  login: "Log in",
  add: "Add to Discord",
  eyebrow: "The all-in-one Discord bot",
  h1a: "Keep raids out.",
  h1b: "Keep people in.",
  heroLead:
    "Sakutina stops raids, explains who is behaving strangely, and runs your server's economy and games. One bot, one dashboard.",
  seeDash: "See the dashboard",
  s1idx: "(01) Anti-Raid and Moderation",
  s1h: "Raids stop before they start.",
  s1p: "Sakutina watches every join. When too many accounts arrive at once, it quarantines, kicks or bans them and can lock the server down. Day to day, it mutes spam, removes unknown links and keeps a record of every sanction.",
  joinsPm: "Joins per minute",
  joinsRange: "03:00 to 03:47, Nightfall Lounge",
  suspected: "Suspected raid",
  lockdown: "Lockdown on",
  fa: "Join bursts.",
  faP: "You set how many joins, over how long, and how young an account can be.",
  fb: "One response, your choice.",
  fbP: "Quarantine, kick or ban, with alerts to your admins.",
  fc: "Auto-moderation.",
  fcP: "Spam, links, banned words and mass mentions, each with its own switch.",
  s2idx: "(02) Phaethon",
  s2h: "Every member gets a score out of 100.",
  s2p: "Phaethon reads how accounts behave: their age, who they move with, how robotic their rhythm is, what they post and how they use coins. Each score comes with its reasons, and only the suspicious parts are shown.",
  risk: "High risk, 96% confidence",
  why: "Why this score",
  linked: "Linked accounts",
  linkedSub: "Same invite, same minute, same avatar",
  s3idx: "(03) Balance and Casino",
  s3h: "An economy with rules you set.",
  s3p: "Members earn coins every day, trade them and spend them. You pick the currency name, the daily reward and the tax on transfers. Games pay back a fixed share of every bet, so nobody gets rich by accident.",
  soon: "Coming soon: a market for your coin",
  daily: "Daily reward",
  dailyP: "Coins claimed once a day, sent with a 5% tax kept by the server.",
  paid: "paid back",
  s4idx: "(04) Profiling and Modules",
  s4h: "Know the people who make it.",
  s4p: "See who talks, who hangs out in voice and who has been around the longest. Then switch on only the parts of Sakutina your server needs. Try it here.",
  s5idx: "(05) The dashboard",
  s5h: "Everything above, in one place.",
  allsys: "All Systems Operational",
  openDash: "Open the dashboard",
  stepsH: "Running in three steps",
  st1: "Step 1",
  st1t: "Invite Sakutina",
  st1p: "Log in with Discord and pick a server where you are an admin.",
  st2: "Step 2",
  st2t: "Choose your modules",
  st2p: "Turn on protection, the economy or games. Defaults are safe from the first minute.",
  st3: "Step 3",
  st3t: "Let it run",
  st3p: "Sakutina acts on its own and tells you what it did. Step in only when you want to.",
  ready: "Add Sakutina to your server",
  cta: "Add Sakutina\u00a0→",
  legal: "© 2026 Sakutina. Not affiliated with Discord.",
  homeAria: "Sakutina home",
  sectionsAria: "Sections",
  orbitAria: "Sakutina at the center of its seven modules",
  ppAlt: "Sakutina, the bot's mascot waving",
  raidAria:
    "Joins per minute stay between 1 and 4, then jump to 38 at 03:30. Sakutina flags a suspected raid and locks the server.",
  riskAria: "Risk score 92 out of 100",
  netAria: "shadow.fox_88 is linked to six other accounts with risk scores between 66 and 88",
  candleAria: "Candlestick chart of the coin price over 40 hours",
  footerAria: "Footer",
  langAria: "Language",
  since: ", since ",
  betsFrom: "Bets from",
  betsTo: "to",
  msgs: " msgs",
  messages: "messages",
  protected: "Protected",
  kpiMessages: "Messages, 24 h",
  kpiCoins: "Coins in circulation",
  kpiActive: "Active members",
  sep: ",",
  dec: ".",
  mSuffix: "M",
};

export type Copy = typeof en;

const fr: Copy = {
  navSec: "Sécurité",
  navPh: "Phaethon",
  navEco: "Économie",
  navCom: "Communauté",
  login: "Se connecter",
  add: "Ajouter à Discord",
  eyebrow: "Le bot Discord tout-en-un",
  h1a: "Raids dehors.",
  h1b: "Membres dedans.",
  heroLead:
    "Sakutina bloque les raids, explique qui se comporte étrangement, et fait tourner l'économie et les jeux de votre serveur. Un bot, un tableau de bord.",
  seeDash: "Voir le tableau de bord",
  s1idx: "(01) Anti-Raid et Modération",
  s1h: "Les raids s'arrêtent avant de commencer.",
  s1p: "Sakutina surveille chaque arrivée. Quand trop de comptes arrivent d'un coup, il les met en quarantaine, les expulse ou les bannit, et peut verrouiller le serveur. Au quotidien, il rend muet le spam, supprime les liens inconnus et garde une trace de chaque sanction.",
  joinsPm: "Arrivées par minute",
  joinsRange: "03:00 à 03:47, Nightfall Lounge",
  suspected: "Raid suspecté",
  lockdown: "Verrouillé",
  fa: "Pics d'arrivées.",
  faP: "Vous fixez combien d'arrivées, sur quelle durée, et l'âge minimum d'un compte.",
  fb: "Une réponse, votre choix.",
  fbP: "Quarantaine, expulsion ou bannissement, avec alertes à vos admins.",
  fc: "Auto-modération.",
  fcP: "Spam, liens, mots interdits et mentions de masse, chacun avec son interrupteur.",
  s2idx: "(02) Phaethon",
  s2h: "Chaque membre reçoit une note sur 100.",
  s2p: "Phaethon analyse le comportement des comptes : leur âge, leurs fréquentations, la régularité robotique de leur rythme, ce qu'ils publient et comment ils utilisent les coins. Chaque note vient avec ses raisons, et seules les parties suspectes sont affichées.",
  risk: "Risque élevé, 96 % de confiance",
  why: "Pourquoi cette note",
  linked: "Comptes liés",
  linkedSub: "Même invitation, même minute, même avatar",
  s3idx: "(03) Solde et Casino",
  s3h: "Une économie avec vos règles.",
  s3p: "Les membres gagnent des coins chaque jour, les échangent et les dépensent. Vous choisissez le nom de la monnaie, la récompense quotidienne et la taxe sur les transferts. Les jeux reversent une part fixe de chaque mise : personne ne s'enrichit par accident.",
  soon: "Bientôt : un marché pour votre coin",
  daily: "Récompense quotidienne",
  dailyP: "Coins réclamés une fois par jour, avec une taxe de 5 % conservée par le serveur.",
  paid: "reversé",
  s4idx: "(04) Profilage et Modules",
  s4h: "Connaissez ceux qui font vivre le serveur.",
  s4p: "Voyez qui parle, qui passe du temps en vocal et qui est là depuis le plus longtemps. Activez ensuite seulement les parties de Sakutina dont votre serveur a besoin. Essayez ici.",
  s5idx: "(05) Le tableau de bord",
  s5h: "Tout cela, au même endroit.",
  allsys: "Tous les systèmes sont opérationnels",
  openDash: "Ouvrir le tableau de bord",
  stepsH: "Opérationnel en trois étapes",
  st1: "Étape 1",
  st1t: "Invitez Sakutina",
  st1p: "Connectez-vous avec Discord et choisissez un serveur dont vous êtes administrateur.",
  st2: "Étape 2",
  st2t: "Choisissez vos modules",
  st2p: "Activez la protection, l'économie ou les jeux. Les réglages par défaut sont sûrs dès la première minute.",
  st3: "Étape 3",
  st3t: "Laissez-le tourner",
  st3p: "Sakutina agit seul et vous dit ce qu'il a fait. N'intervenez que si vous le souhaitez.",
  ready: "Ajoutez Sakutina à votre serveur",
  cta: "Ajouter le bot\u00a0→",
  legal: "© 2026 Sakutina. Non affilié à Discord.",
  homeAria: "Accueil Sakutina",
  sectionsAria: "Sections",
  orbitAria: "Sakutina au centre de ses sept modules",
  ppAlt: "Sakutina, la mascotte du bot, qui salue",
  raidAria:
    "Les arrivées par minute restent entre 1 et 4, puis montent à 38 à 03:30. Sakutina signale un raid suspecté et verrouille le serveur.",
  riskAria: "Note de risque : 92 sur 100",
  netAria: "shadow.fox_88 est lié à six autres comptes, avec des notes de risque entre 66 et 88",
  candleAria: "Graphique en chandeliers du prix du coin sur 40 heures",
  footerAria: "Pied de page",
  langAria: "Langue",
  since: ", depuis ",
  betsFrom: "Mises de",
  betsTo: "à",
  msgs: " msgs",
  messages: "messages",
  protected: "Protégé",
  kpiMessages: "Messages, 24 h",
  kpiCoins: "Coins en circulation",
  kpiActive: "Membres actifs",
  sep: " ",
  dec: ",",
  mSuffix: " M",
};

export const COPY: Record<Lang, Copy> = { en, fr };

/** Module names shown in the orbit, the switches and the dashboard preview. */
export type ModuleKey =
  | "Anti-Raid"
  | "Moderation"
  | "Phaethon"
  | "Balance"
  | "Casino"
  | "Profiling"
  | "Modules"
  | "Dashboard";

export const MODULE_NAMES: Record<Lang, Record<ModuleKey, string>> = {
  en: {
    "Anti-Raid": "Anti-Raid",
    Moderation: "Moderation",
    Phaethon: "Phaethon",
    Balance: "Balance",
    Casino: "Casino",
    Profiling: "Profiling",
    Modules: "Modules",
    Dashboard: "Dashboard",
  },
  fr: {
    "Anti-Raid": "Anti-Raid",
    Moderation: "Modération",
    Phaethon: "Phaethon",
    Balance: "Solde",
    Casino: "Casino",
    Profiling: "Profilage",
    Modules: "Modules",
    Dashboard: "Tableau de bord",
  },
};

export const FACTOR_NAMES: Record<Lang, readonly string[]> = {
  en: ["Account integrity", "Coordination", "Automation", "Content abuse", "Economy abuse", "History"],
  fr: ["Intégrité du compte", "Coordination", "Automatisation", "Abus de contenu", "Abus d'économie", "Historique"],
};

export const ROLE_NAMES: Record<Lang, Record<"Moderator" | "Regular" | "Booster" | "Member", string>> = {
  en: { Moderator: "Moderator", Regular: "Regular", Booster: "Booster", Member: "Member" },
  fr: { Moderator: "Modérateur", Regular: "Habitué", Booster: "Booster", Member: "Membre" },
};

export const MONTHS_FR: Record<string, string> = { Mar: "mars", Jun: "juin", Jan: "janv.", Aug: "août", Oct: "oct." };

export const GAME_NAMES_FR: Record<string, string> = { Coinflip: "Pile ou face", Slots: "Machines à sous" };

export const MARQUEE_WORDS = ["Protect", "Understand", "Reward", "Play"] as const;

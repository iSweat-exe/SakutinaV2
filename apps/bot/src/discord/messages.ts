/**
 * Textes affichés aux utilisateurs, en français, centralisés. Ce sont des
 * libellés et des phrases : la mise en forme (embeds, couleurs) est dans `ui/`.
 */
export const messages = {
  groups: {
    economy: "Argent : solde, travail, récompense quotidienne, dépôts, paiements",
    casino: "Jeux d'argent : machine à sous, blackjack, roulette, pile ou face",
    market: "Bourse : le cours de l'action Casino, acheter et vendre des actions",
    me: "Vous : statistiques, carte de profil, effacement des données",
    info: "Informations sur un membre, son avatar, la latence du bot",
    server: "Le serveur : infos, classements, salons, activité, santé",
    phaethon: "Profilage des membres : dossier, recherche, comparaison",
    mod: "Modération : avertir, timeout, expulser, bannir, nettoyer",
  },

  errors: {
    unauthorizedTitle: "Accès refusé",
    unauthorized: "Cette commande est réservée à un rôle plus élevé.",
    wrongGuildTitle: "Réservé aux serveurs",
    wrongGuild: "Cette commande ne fonctionne que sur un serveur, pas en message privé.",
    internalTitle: "Erreur interne",
    internal: "La commande a rencontré une erreur. Veuillez réessayer dans un instant.",
    notYoursTitle: "Ce message n'est pas à vous",
    notYours: "Ces boutons appartiennent à l'auteur de la commande.",
    adminOnlyTitle: "Données réservées",
    adminOnly: "Réservé aux administrateurs.",
  },

  controls: {
    days: (days: number) => `${days} j`,
    previous: "Précédent",
    next: "Suivant",
    page: (page: number) => `Page ${page}`,
    categoryPlaceholder: "Choisir un classement",
    periodLabel: "Période",
    depositAll: "Tout déposer",
    withdrawAll: "Tout retirer",
    custom: "Montant précis…",
    refresh: "Actualiser",
    confirmForget: "Effacer mes données",
    cancel: "Annuler",
  },

  balanceActions: {
    depositText: "Déposer tout le portefeuille à la banque",
    withdrawText: "Retirer toute la banque vers le portefeuille",
    modalTitle: "Déposer ou retirer",
    operationLabel: "Opération",
    operationPlaceholder: "Choisissez une opération",
    deposit: "Déposer",
    withdraw: "Retirer",
    amountLabel: "Montant",
    amountHelp: "Un entier positif, ou « tout ».",
    amountPlaceholder: "ex. 250",
    noticeLabel: "Dernière opération",
    depositDone: (amount: string) => `${amount} déposés`,
    withdrawDone: (amount: string) => `${amount} retirés`,
    invalidOperationTitle: "Opération inconnue",
    invalidOperation: "Choisissez « Déposer » ou « Retirer ».",
  },

  forgetDialog: {
    title: "Effacer vos données ?",
    text: "Supprime **compteurs, salons, relations, rythme, présence, historique d'identité et fiche de membre**. Définitif.",
    keptTitle: "Conservé",
    kept: "Solde, historique d'économie, avertissements et sanctions en cours, journal d'audit (30 j).",
    cancelledTitle: "Annulé",
    cancelled: "Rien n'a été modifié.",
  },

  admin: {
    activity: {
      description: "Afficher l'activité détaillée d'un membre (réservé aux administrateurs)",
      memberOption: "Membre à consulter (vous par défaut)",
    },
    health: {
      description: "Afficher l'état de santé de Sakutina",
      title: "État du bot",
      status: "Statut",
      ok: "Opérationnel",
      degraded: "Dégradé",
      discord: "Discord",
      connected: "Connecté",
      disconnected: "Déconnecté",
      ping: "Ping WebSocket",
      memory: "Mémoire",
      uptime: "Disponibilité",
      environment: "Environnement",
      unavailable: "indisponible",
    },
  },

  general: {
    memberOption: "Membre concerné (vous par défaut)",
    ping: {
      description: "Mesurer la latence du bot",
      title: "Pong !",
      api: "API Discord",
      websocket: "WebSocket",
      unavailable: "indisponible",
    },
    userInfo: {
      description: "Afficher les informations publiques d'un membre",
      selfTitle: "Informations du compte",
      id: "Identifiant",
      created: "Compte créé",
      joined: "Arrivée sur le serveur",
      roles: "Rôles",
      noRoles: "Aucun",
      bot: "Compte de bot",
    },
    serverInfo: {
      description: "Afficher les informations du serveur",
      owner: "Propriétaire",
      members: "Membres",
      channels: "Salons",
      roles: "Rôles",
      boosts: "Boosts",
      boostValue: (count: number, tier: number) => `${count} (niveau ${tier})`,
      created: "Création",
    },
    avatar: {
      description: "Afficher l'avatar d'un membre en grand",
      title: (name: string) => `Avatar de ${name}`,
      self: "Votre avatar",
      account: "Avatar du compte",
      server: "Avatar sur ce serveur",
    },
    treasury: {
      description: "Voir la réserve du serveur, le casino et le jackpot",
      title: "Réserve du serveur",
      poolsLine: (casino: string, jackpot: string) => `Casino ${casino} · jackpot ${jackpot}`,
      salaryLine: (permille: number) =>
        permille > 0
          ? `Budget des salaires : ${(permille / 10).toLocaleString("fr-FR")} % de la réserve par jour, partagé entre les actifs`
          : "Pas de salaires : le budget est à zéro",
      wealthLine: (active: number, idle: number) =>
        active > 0 || idle > 0
          ? `Impôt sur la fortune, chaque dimanche : ${(active / 10).toLocaleString("fr-FR")} % (inactifs ${(idle / 10).toLocaleString("fr-FR")} %), au-delà du seuil`
          : "Pas d'impôt sur la fortune",
      taxLine: (percent: number) => (percent > 0 ? `Taxe sur les paiements : ${percent} %` : "Aucune taxe sur les paiements"),
      interestLine: (permille: number) =>
        permille > 0
          ? `Intérêt de la banque : ${(permille / 10).toLocaleString("fr-FR")} % par jour, payé par le trésor`
          : "Pas d'intérêt sur la banque",
      footer: "Circuit fermé : aucune pièce n'est créée. La réserve paie les salaires et les intérêts, et reçoit les taxes, l'impôt et une part du bénéfice du casino.",
    },
  },

  economy: {
    memberOption: "Membre à consulter (vous par défaut)",
    amountOption: "Montant (entier positif)",
    allOption: "Tout le solde disponible",
    fields: { wallet: "Portefeuille", bank: "Banque", total: "Total" },
    balance: {
      description: "Afficher votre solde (ou celui d'un membre)",
      title: "Solde",
      /** Sous le total : où est l'argent. */
      split: (wallet: string, bank: string) => `Portefeuille ${wallet} · Banque ${bank}`,
    },
    work: {
      description: "Travailler pour gagner de l'argent (une fois par heure)",
      title: "Travail terminé",
      reward: (amount: string, wallet: string, next: string) => `**+${amount}** · portefeuille ${wallet}\nProchain travail ${next}`,
    },
    daily: {
      description: "Récupérer votre récompense quotidienne (série de jours consécutifs)",
      title: "Récompense quotidienne",
      reward: (amount: string, days: number, wallet: string, next: string) =>
        `**+${amount}** · série de ${days} jour${days > 1 ? "s" : ""}\nPortefeuille ${wallet} · prochaine récompense ${next}`,
    },
    deposit: {
      description: "Déposer de l'argent du portefeuille vers la banque",
      title: "Dépôt effectué",
      text: (amount: string, wallet: string, bank: string) => `**${amount}** en banque\nPortefeuille ${wallet} · Banque ${bank}`,
    },
    withdraw: {
      description: "Retirer de l'argent de la banque vers le portefeuille",
      title: "Retrait effectué",
      text: (amount: string, wallet: string, bank: string) => `**${amount}** en portefeuille\nPortefeuille ${wallet} · Banque ${bank}`,
    },
    replayed: {
      title: "Déjà traité",
      text: "Opération déjà enregistrée.",
    },
    history: {
      description: "Afficher vos dernières transactions",
      title: "Transactions",
      empty: "Aucune transaction.",
      balances: (wallet: string, bank: string) => `Portefeuille ${wallet} · Banque ${bank}`,
    },
    kinds: {
      earn: "Gain",
      spend: "Dépense",
      deposit: "Dépôt",
      withdraw: "Retrait",
    },
    errors: {
      invalidAmountTitle: "Montant invalide",
      invalidAmount: "Entier positif requis.",
      chooseOneTitle: "Montant manquant",
      chooseOne: "Un montant, ou « tout ».",
      insufficientTitle: "Fonds insuffisants",
      insufficient: (available: string) => `Disponible : **${available}**.`,
      cooldownTitle: "Pas si vite",
      cooldown: (when: string) => `Revenez ${when}.`,
      limitTitle: "Plafond atteint",
      limit: "Plafond de solde dépassé.",
      betLimitsTitle: "Mise refusée",
      betLimits: (min: string, max: string) => `La mise doit être comprise entre **${min}** et **${max}**.`,
      gameClosedTitle: "Jeu fermé",
      gameClosed: (game: string) => `**${game}** est fermé sur ce serveur : les administrateurs l'ont désactivé.`,
      selfTransferTitle: "Destinataire invalide",
      selfTransfer: "Vous ne pouvez pas vous payer vous-même.",
      salaryExhaustedTitle: "Budget épuisé",
      salaryExhausted: "La réserve a versé tout son budget de salaires du jour. Revenez demain (UTC).",
      reserveShortTitle: "Réserve insuffisante",
      reserveShort: (available: string) => `La réserve ne peut pas racheter ces actions maintenant (elle contient **${available}**).`,
      casinoLimitTitle: "Casino trop juste",
      casinoLimit: (max: string) => `Le compte du casino couvre au plus **${max}** de mise sur ce jeu.`,
      casinoClosed: "Le casino a atteint sa perte maximale du jour. Il rouvre demain (UTC).",
      sharesTitle: "Actions indisponibles",
      shares: (count: number) => `Seulement **${count}** action${count > 1 ? "s" : ""} disponible${count > 1 ? "s" : ""}.`,
    },
    pay: {
      description: "Envoyer de l'argent de votre portefeuille à un membre",
      memberOption: "Membre qui reçoit",
      title: "Paiement envoyé",
      sent: (recipient: string, amount: string, tax: string | null, wallet: string) =>
        `${recipient} reçoit **${amount}**${tax ? ` (taxe ${tax})` : ""}\nPortefeuille ${wallet}`,
      botTitle: "Destinataire invalide",
      bot: "Un bot ne peut pas recevoir d'argent.",
    },
  },

  card: {
    description: "Afficher votre carte de profil (activité et solde)",
    title: "Carte de profil",
    unavailableTitle: "Cartes indisponibles",
    unavailable: "Génération d'image indisponible.",
    labels: {
      messages: "Messages",
      voice: "Vocal",
      wallet: "Portefeuille",
      bank: "Banque",
    },
  },

  tracking: {
    daysOption: "Nombre de jours (1 à 30)",
    inactiveDaysOption: "Jours sans activité (1 à 365)",
    memberOption: "Membre concerné (vous par défaut)",

    leaderboard: {
      description: "Afficher un classement du serveur",
      categoryOption: "Classement à afficher",
      title: (category: string) => `Classement · ${category}`,
      scopeDays: (days: number) => `${days} dernier${days > 1 ? "s" : ""} jour${days > 1 ? "s" : ""}`,
      scopeEconomy: "Portefeuille + banque",
      empty: "Aucune donnée pour ce classement.",
      categories: {
        messages: "Messages",
        voice: "Temps vocal",
        reactions: "Réactions données",
        economy: "Richesse",
      },
    },

    stats: {
      description: "Afficher l'activité suivie d'un membre et ses étiquettes",
      title: (days: number) => `Activité · ${days} dernier${days > 1 ? "s" : ""} jour${days > 1 ? "s" : ""}`,
      sections: {
        writing: "Écriture",
        media: "Médias et liens",
        reactions: "Réactions",
        voice: "Vocal",
        server: "Serveur",
        presence: "Présence",
      },
      messages: "Messages",
      characters: "Caractères",
      replies: "Réponses",
      attachments: "Pièces jointes",
      mentions: "Mentions",
      given: "Données",
      received: "Reçues",
      joins: "Arrivées",
      leaves: "Départs",
      invites: "Invitations",
      lastActive: "Dernière activité",
      neverActive: "Aucune observée",
      joined: "Arrivée",
      tags: "Étiquettes",
      noTags: "Aucune pour l'instant.",
      disclaimer: "Indicatif, calculé sur des seuils.",
    },

    tags: {
      new: (measured: number, threshold: number) =>
        `**Nouveau** · ${measured} j (seuil < ${threshold} j)`,
      active: (measured: number, threshold: number) =>
        `**Actif** · ${measured} j (seuil < ${threshold} j)`,
      inactive: (measured: number, threshold: number) =>
        `**Inactif** · ${measured} j (seuil ≥ ${threshold} j)`,
      chatty: (measured: number, threshold: number) =>
        `**Bavard** · ${measured} msg/j (seuil ≥ ${threshold})`,
      "voice-regular": (measured: number, threshold: number) =>
        `**Pilier vocal** · ${Math.round(measured / 3600)} h (seuil ≥ ${Math.round(threshold / 3600)} h)`,
      social: (measured: number, threshold: number) =>
        `**Sociable** · ${measured} interactions (seuil ≥ ${threshold})`,
      "media-sharer": (measured: number, threshold: number) =>
        `**Partageur de médias** · ${measured} pièces (seuil ≥ ${threshold})`,
    },

    inactive: {
      description: "Lister les membres sans activité depuis un certain temps",
      title: (days: number) => `Inactifs depuis ${days} j ou plus`,
      count: (count: number) => `${count} membre${count > 1 ? "s" : ""}`,
      never: "jamais actif",
      empty: "Aucun membre inactif.",
      note: "« jamais actif » : compté depuis la 1re observation.",
    },

    channels: {
      description: "Afficher les salons les plus actifs",
      title: (days: number) => `Salons les plus actifs · ${days} j`,
      messages: "Messages",
      voice: "Vocal",
      empty: "Aucune donnée.",
    },

    serverStats: {
      description: "Afficher les statistiques du serveur sur une période",
      title: (days: number) => `Statistiques du serveur · ${days} j`,
      activeMembers: "Membres actifs",
      busiest: "Heures les plus actives (UTC)",
      hourly: "Messages par heure (UTC)",
    },

    forget: {
      description: "Effacer vos données enregistrées par le bot (activité et économie)",
      needConfirmTitle: "Confirmation requise",
      needConfirm: "Relancez avec `confirm` à **true** pour effacer.",
      doneTitle: "Données effacées",
      done: "Compteurs, salons, relations, rythme, présence, identité, fiche, solde, actions et historique d'économie effacés. Votre argent est retourné à la réserve du serveur.",
      keptTitle: "Conservé",
      kept: "Avertissements de modération, journal d'audit (30 j).",
    },
  },

  phaethon: {
    memberOption: "Membre à étudier",
    unavailableTitle: "Dossier indisponible",
    unavailable: "Ce membre est introuvable.",

    profile: {
      description: "Dossier complet d'un membre",
      title: "Dossier",
      sections: {
        identity: "Identité",
        activity: "Activité",
        rhythm: "Rythme",
        channels: "Salons",
        relations: "Relations",
        presence: "Présence",
        games: "Activités Discord",
        timeline: "Chronologie",
        monthly: "Mois précédents",
        tags: "Étiquettes",
      },
      name: "Nom",
      created: "Compte créé",
      joined: "Arrivée",
      left: "Départ",
      lastActive: "Dernière activité",
      neverActive: "aucune observée",
      roles: "Rôles",
      noRoles: "aucun",
      boost: "Boost depuis",
      timeout: "Timeout jusqu'à",
      bot: "Compte de bot",
      peakHours: "Pics",
      nightShare: "Nuit",
      noRhythm: "Aucun message observé.",
      text: "Écrit",
      voice: "Vocal",
      none: "Aucune donnée.",
      contact: (sent: number, received: number, voice: string) =>
        `envoyé **${sent}** · reçu **${received}**${voice ? ` · vocal **${voice}**` : ""}`,
      presenceOff: "Non suivie ou aucun temps observé.",
      statuses: { online: "En ligne", idle: "Absent", dnd: "Ne pas déranger" },
      kinds: {
        playing: "Joue",
        streaming: "Stream",
        listening: "Écoute",
        watching: "Regarde",
        competing: "Compétition",
      },
      monthLine: (month: string, messages: string, voice: string, days: number) =>
        `**${month}** · ${messages} msg · ${voice} · ${days} j actifs`,
      footer: (days: number) => `Fenêtre ${days} j · aucune donnée de contenu`,
    },

    identity: {
      nickname: (from: string, to: string) => `Pseudo ${from} → ${to}`,
      username: (from: string, to: string) => `Nom d'utilisateur ${from} → ${to}`,
      "display-name": (from: string, to: string) => `Nom affiché ${from} → ${to}`,
      avatar: () => "Avatar modifié",
      roles: (change: string) => `Rôles ${change}`,
      boost: (active: boolean) => (active ? "Boost activé" : "Boost retiré"),
      timeout: (active: boolean) => (active ? "Timeout appliqué" : "Timeout levé"),
      unset: "aucun",
    },

    search: {
      description: "Chercher des membres par critères combinés (30 derniers jours)",
      title: (count: number) => `Recherche · ${count} résultat${count > 1 ? "s" : ""}`,
      empty: "Aucun membre ne correspond.",
      options: {
        minMessages: "Messages minimum",
        minVoiceHours: "Heures de vocal minimum",
        nightOwl: "Écrit surtout la nuit",
        joinedWithin: "Arrivé depuis moins de N jours",
        inactiveDays: "Sans activité depuis N jours ou plus",
        game: "Joue (ou a joué) à… (nom partiel)",
        tag: "Étiquette",
        talksTo: "Échange avec ce membre",
        sort: "Tri",
      },
      sorts: {
        messages: "Messages",
        voice: "Vocal",
        social: "Interactions",
        recent: "Activité récente",
      },
      tagNames: {
        new: "Nouveau",
        active: "Actif",
        inactive: "Inactif",
        chatty: "Bavard",
        "voice-regular": "Pilier vocal",
        social: "Sociable",
        "media-sharer": "Partageur de médias",
      },
      criteria: "Critères",
      noCriteria: "aucun",
      night: (share: number) => `nuit ${share} %`,
      sortedBy: (sort: string) => `tri : ${sort.toLowerCase()}`,
    },

    compare: {
      description: "Comparer deux membres côte à côte",
      leftOption: "Premier membre",
      rightOption: "Second membre",
      title: "Comparaison",
      sections: {
        activity: "Activité",
        between: "Entre eux",
        common: "En commun",
      },
      messages: "Messages",
      voice: "Vocal",
      reactions: "Réactions données",
      nightShare: "Part de nuit",
      lastActive: "Dernière activité",
      sentTo: (from: string, to: string, replies: number, mentions: number, reactions: number) =>
        `${from} → ${to} : **${replies}** réponses · **${mentions}** mentions · **${reactions}** réactions`,
      voiceTogether: "Vocal ensemble",
      contacts: "Contacts partagés",
      games: "Jeux partagés",
      rhythm: "Rythmes semblables",
      nothingShared: "rien",
    },

    alerts: {
      posted: "Alerte",
      "suspicious-account": {
        title: "Compte très récent",
        text: (member: string, measured: number, threshold: number) =>
          `${member} rejoint avec un compte créé il y a ${measured} j (seuil < ${threshold} j).`,
      },
      "identity-churn": {
        title: "Identité changeante",
        text: (member: string, measured: number, threshold: number) =>
          `${member} : ${measured} changements de nom ou d'avatar en 24 h (seuil ≥ ${threshold}).`,
      },
      "gone-quiet": {
        title: "Membre régulier silencieux",
        text: (member: string, measured: number, threshold: number) =>
          `${member} est actif d'habitude mais n'a rien fait depuis ${measured} j (seuil ≥ ${threshold} j).`,
      },
      "activity-spike": {
        title: "Pic d'activité",
        text: (member: string, measured: number, threshold: number) =>
          `${member} : ${measured} messages aujourd'hui (seuil ≥ ${threshold}).`,
      },
    },
  },

  casino: {
    betOption: "Mise (entier positif)",
    symbols: { cherry: "Cerise", lemon: "Citron", plum: "Prune", bell: "Cloche", seven: "Sept" },
    won: (net: string) => `Gagné **+${net}**`,
    lost: (net: string) => `Perdu **−${net}**`,
    even: "Mise rendue",
    /** Ligne de pied d'un jeu : la mise et ce qu'il reste. */
    stake: (bet: string, wallet: string) => `-# Mise ${bet} · Portefeuille ${wallet}`,
    slots: {
      description: "Machine à sous : trois rouleaux, jusqu'à 120 fois la mise, et trois 7 remportent le jackpot",
      title: "Machine à sous",
      reels: (reels: string) => `**${reels}**`,
      cherries: "Deux cerises : 1,6 fois la mise.",
      triple: (multiple: number) => `Trois symboles identiques : ${multiple} fois la mise.`,
      jackpot: (amount: string) => `**Jackpot !** La cagnotte entière est à vous : ${amount}.`,
    },
    coinflip: {
      description: "Pile ou face : doublez votre mise avec 49 % de chances",
      sideOption: "Votre côté",
      heads: "Face",
      tails: "Pile",
      title: "Pile ou face",
      landed: (side: string, chosen: string) => `La pièce est tombée sur **${side}** (vous aviez choisi **${chosen}**).`,
    },
    roulette: {
      description: "Roulette européenne : une couleur, la parité, une moitié du tapis ou un numéro (35 contre 1)",
      onOption: "Sur quoi miser",
      numberOption: "Le numéro (0 à 36), si vous misez sur un numéro",
      title: "Roulette",
      choices: {
        red: "Rouge",
        black: "Noir",
        even: "Pair",
        odd: "Impair",
        low: "Manque (1 à 18)",
        high: "Passe (19 à 36)",
        number: "Numéro plein",
      },
      colors: { red: "rouge", black: "noir", green: "vert" },
      landed: (pocket: number, color: string) => `La bille s'arrête sur le **${pocket}** (${color}).`,
      betOn: (label: string) => `Mise sur : ${label}`,
      numberMissingTitle: "Numéro manquant",
      numberMissing: "Indiquez le numéro (0 à 36) sur lequel vous misez.",
      numberUnexpectedTitle: "Numéro inutile",
      numberUnexpected: "Le numéro ne sert que pour une mise sur « Numéro plein ».",
    },
    blackjack: {
      description: "Blackjack contre le croupier : blackjack payé 3 contre 2, il s'arrête sur tous les 17",
      title: "Blackjack",
      you: "Vous",
      dealer: "Croupier",
      total: (total: number) => `**${total}**`,
      hands: (player: string, dealer: string) => `**Vous** ${player}\n**Croupier** ${dealer}`,
      hit: "Tirer",
      stand: "Rester",
      double: "Doubler",
      outcomes: {
        blackjack: "Blackjack",
        win: "Gagné",
        push: "Égalité",
        lose: "Perdu",
      },
      bust: "Vous dépassez 21.",
      dealerBust: "Le croupier dépasse 21.",
      timeout: "Main terminée faute de réponse : vous restez.",
      goneTitle: "Main introuvable",
      gone: "Cette main n'existe plus (elle est terminée, ou le bot a redémarré pendant la partie).",
      busyTitle: "Un instant",
      busy: "Votre action précédente est encore en cours.",
    },
  },

  automod: {
    reasons: {
      spam: "Spam : messages répétés ou en rafale",
      links: "Lien non autorisé pour un nouveau membre",
      words: "Mot interdit",
      mentions: "Trop de personnes mentionnées d'un coup",
    },
    dmTitle: "Vous avez été réduit au silence",
    dmExtra: (minutes: number) => `Durée : ${minutes} min · sanction automatique`,
  },

  moderation: {
    memberOption: "Membre concerné",
    reasonOption: "Motif (300 caractères max)",

    warn: {
      description: "Avertir un membre",
      title: "Membre averti",
      text: (member: string, id: number, total: number) =>
        `${member} · avertissement **n°${id}** (${total} au total)`,
      dmTitle: "Avertissement",
    },
    warnings: {
      description: "Lister les avertissements d'un membre",
      title: "Avertissements",
      empty: "Aucun avertissement.",
      total: (total: number, shown: number) =>
        total > shown ? `${total} au total · ${shown} derniers affichés` : `${total} au total`,
      line: (id: number, when: string, moderator: string, reason: string) =>
        `**n°${id}** ${when} par ${moderator} — ${reason}`,
    },
    unwarn: {
      description: "Retirer un avertissement",
      idOption: "Numéro de l'avertissement",
      title: "Avertissement retiré",
      text: (id: number) => `L'avertissement **n°${id}** est retiré.`,
      missingTitle: "Avertissement introuvable",
      missing: "Aucun avertissement ne porte ce numéro.",
    },
    timeout: {
      description: "Réduire un membre au silence pendant une durée",
      durationOption: "Durée : 30m, 2h, 7d (1 minute à 28 jours)",
      title: "Timeout appliqué",
      text: (member: string, until: string) => `${member} · jusqu'au ${until}`,
      dmTitle: "Timeout",
      invalidTitle: "Durée invalide",
      invalid: "Exemples : 30m, 2h, 7d (de 1 minute à 28 jours).",
    },
    untimeout: {
      description: "Lever le timeout d'un membre",
      title: "Timeout levé",
      text: (member: string) => `${member} peut de nouveau écrire.`,
    },
    kick: {
      description: "Expulser un membre (il peut revenir)",
      title: "Membre expulsé",
      text: (member: string) => `${member} est expulsé.`,
      dmTitle: "Expulsion",
    },
    ban: {
      description: "Bannir un membre, présent ou non",
      deleteDaysOption: "Jours de messages à supprimer (0 à 7)",
      title: "Membre banni",
      text: (member: string) => `${member} est banni.`,
      dmTitle: "Bannissement",
    },
    unban: {
      description: "Lever le bannissement d'un utilisateur",
      userIdOption: "Identifiant de l'utilisateur banni",
      title: "Bannissement levé",
      text: (userId: string) => `<@${userId}> n'est plus banni.`,
      invalidTitle: "Identifiant invalide",
      invalid: "Indiquez l'identifiant numérique de l'utilisateur.",
    },
    purge: {
      description: "Supprimer les derniers messages du salon",
      countOption: "Nombre de messages à supprimer (1 à 100)",
      memberOption: "Ne supprimer que ceux de ce membre",
      title: "Salon nettoyé",
      text: (count: number) => `**${count}** message${count > 1 ? "s" : ""} supprimé${count > 1 ? "s" : ""}.`,
      none: "Aucun message à supprimer (Discord refuse ceux de plus de 14 jours).",
      unavailableTitle: "Salon non pris en charge",
      unavailable: "Ce salon ne permet pas de supprimer des messages en masse.",
    },

    refusals: {
      title: "Action refusée",
      self: "Vous ne pouvez pas vous sanctionner vous-même.",
      bot: "Le bot ne peut pas se sanctionner lui-même.",
      owner: "Le propriétaire du serveur est intouchable.",
      role: "Ce membre a un rôle égal ou supérieur au vôtre.",
      position: "Son plus haut rôle Discord est égal ou supérieur au vôtre.",
      "bot-position": "Le bot n'a pas un rôle assez haut pour agir sur ce membre.",
      notMember: "Ce membre n'est pas sur le serveur.",
    },
    failedTitle: "Action impossible",
    failed: "Discord a refusé l'action : vérifiez les permissions du bot.",
    reasonLabel: "Motif",
    serverLine: (name: string) => `Serveur : ${name}`,
  },
  market: {
    countOption: "Nombre d'actions",
    view: {
      description: "Voir le cours de l'action Casino et vos actions",
      title: "Action Casino",
      price: (price: string) => `## ${price} par action`,
      change: (sign: string, percent: string) => `${sign}${percent} % sur 24 h`,
      noChange: "Pas encore de cours d'il y a 24 h",
      holding: (count: number, value: string) =>
        count > 0 ? `Vous détenez **${count}** action${count > 1 ? "s" : ""}, soit ${value}` : "Vous n'avez pas d'action Casino.",
      fund: (fund: string, jackpot: string) => `Compte du casino ${fund} · jackpot ${jackpot}`,
      float: (count: number, total: number) => `${count} action${count > 1 ? "s" : ""} sur ${total} encore à vendre par le serveur`,
      footer: "Le cours est le compte du casino divisé par le nombre d'actions : il monte quand les joueurs perdent, baisse quand ils gagnent. Chaque dimanche, 20 % du bénéfice de la semaine est versé aux actionnaires. 1 % de frais à l'achat et à la vente.",
    },
    buy: {
      description: "Acheter des actions Casino au serveur",
      title: "Actions achetées",
      text: (count: number, cost: string, fee: string, wallet: string) =>
        `**+${count}** action${count > 1 ? "s" : ""} pour ${cost} (frais ${fee})\nPortefeuille ${wallet}`,
    },
    sell: {
      description: "Vendre des actions Casino au serveur",
      title: "Actions vendues",
      text: (count: number, proceeds: string, fee: string, wallet: string) =>
        `**−${count}** action${count > 1 ? "s" : ""} contre ${proceeds} (frais ${fee})\nPortefeuille ${wallet}`,
    },
  },
} as const;

/**
 * Textes affichés aux utilisateurs, en français, centralisés. Ce sont des
 * libellés et des phrases : la mise en forme (embeds, couleurs) est dans `ui/`.
 */
export const messages = {
  errors: {
    unauthorizedTitle: "Accès refusé",
    unauthorized: "Cette commande est réservée à un rôle plus élevé.",
    wrongGuildTitle: "Serveur non pris en charge",
    wrongGuild: "Cette commande n'est pas disponible sur ce serveur.",
    internalTitle: "Erreur interne",
    internal: "La commande a rencontré une erreur. Veuillez réessayer dans un instant.",
    notYoursTitle: "Ce message n'est pas à vous",
    notYours: "Seul l'auteur de la commande peut utiliser ces boutons. Lancez la vôtre.",
    adminOnlyTitle: "Données réservées",
    adminOnly: "Seuls les administrateurs peuvent consulter cette donnée.",
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
    text: "Le bot va supprimer **vos compteurs d'activité, vos statistiques par salon et votre fiche de membre**. Cette action est définitive.",
    keptTitle: "Conservé",
    kept: "Votre solde et votre historique d'économie, ainsi que le journal d'audit (purgé à 30 jours).",
    cancelledTitle: "Annulé",
    cancelled: "Vos données n'ont pas été modifiées.",
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
      account: "Avatar du compte",
      server: "Avatar sur ce serveur",
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
    },
    work: {
      description: "Travailler pour gagner de l'argent (une fois par heure)",
      title: "Travail terminé",
      reward: (amount: string) => `Vous avez gagné **${amount}**.`,
      next: "Prochain travail",
    },
    daily: {
      description: "Récupérer votre récompense quotidienne (série de jours consécutifs)",
      title: "Récompense quotidienne",
      reward: (amount: string) => `Vous récupérez **${amount}**.`,
      streak: "Série",
      days: (count: number) => `${count} jour${count > 1 ? "s" : ""}`,
      next: "Prochaine récompense",
    },
    deposit: {
      description: "Déposer de l'argent du portefeuille vers la banque",
      title: "Dépôt effectué",
      text: (amount: string) => `**${amount}** ont rejoint votre banque.`,
    },
    withdraw: {
      description: "Retirer de l'argent de la banque vers le portefeuille",
      title: "Retrait effectué",
      text: (amount: string) => `**${amount}** sont de retour dans votre portefeuille.`,
    },
    replayed: {
      title: "Déjà traité",
      text: "Cette opération a déjà été traitée.",
    },
    history: {
      description: "Afficher vos dernières transactions",
      title: "Vos dernières transactions",
      empty: "Aucune transaction pour le moment.",
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
      invalidAmount: "Indiquez un entier positif.",
      chooseOneTitle: "Montant manquant",
      chooseOne: "Indiquez soit un montant, soit l'option « tout ».",
      insufficientTitle: "Fonds insuffisants",
      insufficient: (available: string) => `Vous disposez de **${available}**.`,
      cooldownTitle: "Pas si vite",
      cooldown: (when: string) => `Revenez ${when}.`,
      limitTitle: "Plafond atteint",
      limit: "Cette opération dépasse le plafond de solde autorisé.",
    },
  },

  card: {
    description: "Afficher votre carte de profil (activité et solde)",
    title: (name: string) => `Carte de ${name}`,
    unavailableTitle: "Cartes indisponibles",
    unavailable: "La génération d'images est indisponible pour le moment.",
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
      disclaimer: "Indications calculées sur des seuils, pas des jugements.",
    },

    tags: {
      new: (measured: number, threshold: number) =>
        `**Nouveau** · arrivé il y a ${measured} j (seuil < ${threshold} j)`,
      active: (measured: number, threshold: number) =>
        `**Actif** · dernière activité il y a ${measured} j (seuil < ${threshold} j)`,
      inactive: (measured: number, threshold: number) =>
        `**Inactif** · ${measured} j sans activité (seuil ≥ ${threshold} j)`,
      chatty: (measured: number, threshold: number) =>
        `**Bavard** · ${measured} messages/jour (seuil ≥ ${threshold})`,
      "voice-regular": (measured: number, threshold: number) =>
        `**Pilier vocal** · ${Math.round(measured / 3600)} h (seuil ≥ ${Math.round(threshold / 3600)} h)`,
      social: (measured: number, threshold: number) =>
        `**Sociable** · ${measured} interactions (seuil ≥ ${threshold})`,
      "media-sharer": (measured: number, threshold: number) =>
        `**Partageur de médias** · ${measured} pièces jointes (seuil ≥ ${threshold})`,
    },

    inactive: {
      description: "Lister les membres sans activité depuis un certain temps",
      title: (days: number) => `Inactifs depuis ${days} j ou plus`,
      count: (count: number) => `${count} membre${count > 1 ? "s" : ""} affiché${count > 1 ? "s" : ""}`,
      never: "jamais observé actif, vu pour la première fois",
      empty: "Aucun membre inactif sur cette période.",
      note: "Un membre jamais vu actif est compté depuis la première observation du bot.",
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
      description: "Effacer les données d'activité que le bot a enregistrées sur vous",
      needConfirmTitle: "Confirmation requise",
      needConfirm: "Pour effacer vos données, relancez la commande avec l'option `confirm` à **true**.",
      doneTitle: "Données effacées",
      done: "Vos compteurs, vos salons et votre fiche de membre ont été effacés.",
      keptTitle: "Conservé",
      kept: "Conservés : votre solde et votre historique d'économie, ainsi que le journal d'audit (purgé à 30 jours).",
    },
  },
} as const;

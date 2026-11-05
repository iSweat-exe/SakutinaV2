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
    text: "Supprime **compteurs, statistiques par salon et fiche de membre**. Définitif.",
    keptTitle: "Conservé",
    kept: "Solde, historique d'économie, journal d'audit (30 j).",
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
      reward: (amount: string) => `**+${amount}**`,
      next: "Prochain travail",
    },
    daily: {
      description: "Récupérer votre récompense quotidienne (série de jours consécutifs)",
      title: "Récompense quotidienne",
      reward: (amount: string) => `**+${amount}**`,
      streak: "Série",
      days: (count: number) => `${count} jour${count > 1 ? "s" : ""}`,
      next: "Prochaine récompense",
    },
    deposit: {
      description: "Déposer de l'argent du portefeuille vers la banque",
      title: "Dépôt effectué",
      text: (amount: string) => `**${amount}** en banque.`,
    },
    withdraw: {
      description: "Retirer de l'argent de la banque vers le portefeuille",
      title: "Retrait effectué",
      text: (amount: string) => `**${amount}** en portefeuille.`,
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
    },
  },

  card: {
    description: "Afficher votre carte de profil (activité et solde)",
    title: (name: string) => `Carte de ${name}`,
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
      description: "Effacer vos données d'activité enregistrées par le bot",
      needConfirmTitle: "Confirmation requise",
      needConfirm: "Relancez avec `confirm` à **true** pour effacer.",
      doneTitle: "Données effacées",
      done: "Compteurs, salons et fiche de membre effacés.",
      keptTitle: "Conservé",
      kept: "Solde, historique d'économie, journal d'audit (30 j).",
    },
  },
} as const;

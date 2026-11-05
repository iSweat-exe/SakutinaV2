---
description: Ajouter une commande Discord (fichier, enregistrement, textes, tests) avec le générateur
argument-hint: <section> <nom> [--role member|moderator|admin|owner] [--description "..."]
---

# Ajouter une commande Discord

Arguments : `$ARGUMENTS` (par exemple `economy shop --role member --description "Voir la boutique"`).

1. Sections existantes et commandes déjà là : `docs/inventory.md` (« Commandes Discord »). Ne pas dupliquer l'existant.
2. Lancer `bun run new command $ARGUMENTS`. Le générateur crée le fichier, l'enregistre dans la section, ajoute les textes à `discord/messages.ts`, un test, et met à jour `test/discord/commands/registry.test.ts`.
3. Écrire le vrai comportement dans le fichier créé (options : `.addStringOption(...)` etc.). Règles : textes français dans `messages.ts`, réponse via `ui/replies.ts`, rôle minimal adapté (sanction = modérateur ou plus ; données sur les autres membres = admin), garde-fous de hiérarchie pour toute modération (voir `commands/moderation/shared.ts`), jamais de contenu de message conservé.
4. Compléter le test généré pour couvrir le comportement réel (cas nominal, refus de rôle, cas limites) avec les fakes de `test/support/fakes.ts`.
5. `bun run verify --changed`.
6. Rappeler à l'utilisateur de republier les commandes (`bun run commands:register`) **après** déploiement ; ne pas le faire soi-même.

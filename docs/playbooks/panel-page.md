---
description: Ajouter une page au panneau en suivant le design et les conventions
argument-hint: <route> "<Titre>"
---

# Ajouter une page au panneau

Arguments : `$ARGUMENTS`.

1. Lire `apps/panel/node_modules/next/dist/docs/` pour tout ce qui touche à Next 16 ; ne pas se fier à la mémoire.
2. Créer `apps/panel/src/app/(guild)/<route>/page.tsx` (composant serveur : `metadata`, `PageMain`, vue) en copiant la structure d'une page existante (`anti-raid`, `moderation`).
3. Ajouter la page à `src/lib/nav.ts` (groupe, icône de `src/lib/icons.ts`) et sa clé à `src/lib/features.ts`.
4. Composants : `components/ui/*` (Card, StatCard, Switch, Segmented, DataTable, Locked…). Jetons de couleur dans `globals.css`, pas de couleur en dur hors des graphiques. Éléments cliquables d'au moins 44 px, contraste 4,5:1, état jamais porté par la seule couleur. Textes en anglais.
5. Si la page a besoin de données : fiche `new-panel-fn.md`. Sinon, envelopper les blocs sans données dans `<Locked feature="…">`.
6. `bun run verify --changed --full` et un contrôle visuel (fiche `local-stack.md`). Régénérer l'inventaire : `bun run inventory`.

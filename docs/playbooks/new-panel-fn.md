---
description: Exposer une donnée au panneau via une fonction SQL panel_* sécurisée
argument-hint: <nom> [--summary "..."]
---

# Exposer une donnée au panneau

Arguments : `$ARGUMENTS`.

1. Le panneau ne lit **aucune table** : tout passe par une fonction `panel_*` (voir « Panneau web » dans `docs/architecture.md`). Fonctions existantes : `docs/inventory.md`.
2. Lancer `bun run new panel-fn $ARGUMENTS`. Il crée la migration sécurisée, le test de base, le lecteur serveur et la validation côté panneau.
3. Compléter le SQL : agrégats prêts à afficher, **toujours** filtrés sur `p_guild_id`, pas de lignes brutes inutiles (le plan Supabase gratuit limite taille et puissance). Ne pas toucher aux garde-fous du modèle (`SECURITY DEFINER`, `search_path`, `PERFORM panel_assert_admin`, `REVOKE … FROM PUBLIC`) : `panel-functions.test.ts` les vérifie.
4. Compléter le test de base (données, isolation entre serveurs), la forme TypeScript et sa validation (`<nom>-schema.ts`) : refuser tout ce qui n'a pas la forme attendue.
5. Afficher les données depuis un composant **serveur** sous `<Suspense>` (modèle : `components/dashboard/dashboard-data.tsx`), les passer en paramètres à la vue, puis `wired: true` dans `src/lib/features.ts`.
6. Vérifier visuellement avec `bun run dev:local` (connexion : `http://localhost:54321/__dev/login?as=owner`), puis `bun run verify --changed --full`.

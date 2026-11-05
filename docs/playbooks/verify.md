---
description: Vérifier mon changement (types, tests, lint, inventaire) et corriger ce qui échoue
---

# Vérifier un changement

Lancer `bun run verify --changed` à la racine. Si une étape échoue :

1. Lire la sortie de **cette** étape (affichée sous « ── <étape> »).
2. Corriger la cause, pas le test : ne jamais désactiver, ignorer ou assouplir un test pour passer au vert.
3. Relancer seulement l'étape concernée : `bun run verify --only <étape>`.
4. Quand tout passe, relancer une dernière fois `bun run verify --changed`. Si le panneau a changé, ajouter `--full` (build de production).

Si `inventory:check` échoue : `bun run inventory`, puis inclure `docs/inventory.md` dans le changement.

Conclure en disant précisément ce qui a été vérifié et ce qui ne l'a pas été.

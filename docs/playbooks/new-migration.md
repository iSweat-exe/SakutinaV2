---
description: Changer le schéma de la base (migration SQL + définition Drizzle alignée)
argument-hint: <nom> [--table <table>]
---

# Changer la base

Arguments : `$ARGUMENTS`.

1. Tables et colonnes actuelles : `docs/inventory.md`. Une migration appliquée ne se modifie jamais : toujours une nouvelle.
2. Lancer `bun run new migration $ARGUMENTS`. Avec `--table`, la table, son RLS et sa définition Drizzle (`schema/`) sont créés alignés.
3. Écrire le SQL (découpage des instructions avec `--> statement-breakpoint`). Toute table active RLS. Si elle contient de l'activité : décider la conservation (30 jours par défaut) et ajouter la purge dans `app/background-jobs.ts` ; `/me forget` doit pouvoir l'effacer.
4. Mettre `schema/` à l'identique (colonnes, types, NOT NULL) : `schema-drift.test.ts` détaille tout écart.
5. `bun test test/database` dans `apps/bot`, puis `bun run verify --changed`.
6. Rappeler que la migration s'applique au démarrage du bot (redéploiement Render) et qu'elle est irréversible en production.

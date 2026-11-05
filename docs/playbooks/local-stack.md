---
description: Lancer le panneau en local avec une base de démonstration et le vérifier dans un navigateur
---

# Panneau en local, sans Discord ni Supabase

1. Lancer `bun run dev:local` (en arrière-plan). Il démarre : un faux Supabase (vraies migrations et fonctions `panel_*` sur PGlite, données de démonstration, port 54321), un faux bot (port 3999) et le panneau (port 3000).
2. Connexion directe : `http://localhost:54321/__dev/login?as=owner&to=/dashboard` (`owner` et `admin` ont accès ; `stranger` doit être refusé par la base).
3. Avec Playwright : ouvrir ce lien d'abord (il pose le cookie de session), puis naviguer ; attendre `networkidle`. Les rendus sont conçus pour 1920×1080 et restent lisibles à 390 px.
4. Faux bot en panne : `http://localhost:3999/api/v1/health?state=degraded`.
5. À la fin, arrêter les processus : `pkill -f dev-local/main.ts; pkill -f "next dev"`.

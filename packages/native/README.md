# @sakutina/native

Addon Rust (Node-API via `napi-rs`) chargé par le bot pour le travail CPU qu'on ne veut pas faire sur le thread principal. Pour l'instant : **le rendu des cartes de profil** (`/card`).

## Pourquoi du Rust ici

Dessiner une carte, c'est décoder et redimensionner une image (avatar), la masquer en cercle, dessiner des formes anti-aliasées et rasteriser du texte, puis encoder un PNG. Ce travail :

- est CPU, pas I/O : le faire dans le thread JavaScript bloquerait la réception des événements Discord ;
- tourne ici sur le pool de threads de libuv (`AsyncTask`) : la boucle d'événements reste libre ;
- n'a aucune dépendance système (pas de Cairo, de Skia ni de navigateur) : tout est compilé dans un seul fichier `.node` d'environ 1,7 Mo, police comprise.

Mesures sur la machine de développement (Windows, release) : environ 5 ms pour une première carte, environ 40 ms pour 50 cartes en parallèle, et la boucle d'événements continue de tourner pendant ce temps. Ce n'est pas une preuve qu'une version JavaScript serait trop lente (elle exigerait de toute façon une bibliothèque native de canvas) : le choix tient à l'absence de dépendance système, au rendu déterministe et au contrôle des limites (taille d'avatar, dimensions décodées).

## Frontière avec le TypeScript

- TypeScript décide du **contenu** : textes déjà formatés, statistiques, couleur, permissions (une carte ne montre que l'activité du demandeur).
- Rust ne fait que **dessiner** : aucune règle métier, aucune action Discord.
- Un avatar illisible, trop gros ou trop grand est remplacé par un avatar de remplacement ; des statistiques ou une couleur invalides rejettent la promesse avec un message clair.

## Utilisation

```bash
bun run native:build   # compile et copie dist/sakutina_native.node
bun run native:test    # cargo test
```

Le bot appelle `loadNativeAddon()` (`index.ts`), qui ne lève jamais : sans addon compilé, le bot démarre quand même et `/card` répond que la génération d'images est indisponible.

Sous Windows, un bot en cours d'exécution verrouille `dist/sakutina_native.node` : arrête `bun run dev` avant de recompiler.

## Contenu

```text
src/
  lib.rs                Déclare les deux modules
  card/                 Rendu, en Rust pur (testé seul)
    mod.rs                API publique : render()
    spec.rs               CardSpec, Stat et limites acceptées
    error.rs              CardError
    layout.rs             Géométrie de la carte (pixels)
    palette.rs            Couleurs et lecture de #RRGGBB
    shapes.rs             Rectangles arrondis, remplissages
    text.rs               Police embarquée, mesure, troncature, dessin
    background.rs         Fond en dégradé
    avatar.rs             Décodage sûr, recadrage, masque rond, anneau
    header.rs             Titre, sous-titre, barre d'accent
    stats.rs              Tuiles de statistiques
  bindings/             Liaison Node-API, un fichier par fonctionnalité
    card.rs               renderProfileCard (AsyncTask)
tests/card.rs           Tests d'intégration du rendu complet
assets/                 Geist-Regular.ttf (licence OFL, voir FONT-LICENSE.md)
index.ts                Chargeur et types côté TypeScript
scripts/build.ts        cargo build + copie de la bibliothèque
```

Pour ajouter une fonctionnalité native : un dossier `src/<fonction>/` pour la logique, un fichier `src/bindings/<fonction>.rs` pour l'exposer, et son type dans `index.ts`.

## Déploiement

Le `Dockerfile` compile le crate dans une étape `rust:1-slim-bookworm` et copie `libsakutina_native.so` dans `packages/native/dist/sakutina_native.node`. L'image Docker n'a pas pu être construite pendant le développement (démon Docker indisponible) : valider un premier build et un `/card` réel sur Render.

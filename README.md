# Brouillé · le blind test qui déraille

Un blind test entre amis, sur un seul téléphone. Chacun son tour, on tire une carte, et l’extrait passe dans une pédale d’effet (hélium, à l’envers, disque rayé, karaoké…). Il faut trouver le titre avant la fin du disque.

## Les cartes

| Carte | Ce qui se passe | Points |
| --- | --- | --- |
| Pédale | Une pédale déforme l’extrait. Le joueur répond à voix haute, les autres valident. | 2 |
| Chaos | Les pédales changent toutes les 3 secondes. | 3 |
| Chance | Quatre propositions s’affichent, il faut choisir la bonne. | 1 |

## La musique

- **Deezer** : thèmes tout prêts (Top du moment, Années 80, Rap français, Disney…), recherche de playlist, ou lien de playlist Deezer collé tel quel (le lien « Partager » de l’appli Deezer marche aussi). Ce sont les extraits officiels de 30 secondes, il faut une connexion internet.
- **Airs connus** : neuf airs du domaine public joués par le synthé de l’appli. Marche sans internet.
- **Mes MP3** : des fichiers du téléphone. Le nom du fichier devient la bonne réponse.

## Mettre l’appli en ligne (gratuit, avec Vercel)

1. Va sur [vercel.com](https://vercel.com) et crée un compte avec **Continue with GitHub**.
2. Clique sur **Add New… → Project**, puis **Import** à côté de `blind-test-brouille`.
3. Ne change aucun réglage et clique sur **Deploy**.
4. Une minute plus tard, Vercel te donne une adresse du genre `blind-test-brouille.vercel.app`.

Ensuite, à chaque modification envoyée sur GitHub, Vercel met l’appli à jour tout seul.

## L’installer sur le téléphone

- **iPhone** : ouvre l’adresse dans Safari, touche le bouton Partager, puis **Sur l’écran d’accueil**.
- **Android** : ouvre l’adresse dans Chrome, menu ⋮, puis **Installer l’application**.

Sur iPhone, pense à couper le mode silencieux pour entendre le son.

## Comment c’est fait

Pas de framework ni d’étape de compilation : des fichiers HTML, CSS et JavaScript servis tels quels.

```
index.html            les écrans du jeu
style.css             le thème « pédalier de guitariste »
js/app.js             écrans, cartes, tours de jeu, choix de la musique
js/fx.js              les pédales d’effet (Web Audio)
js/player.js          le lecteur : un disque + une pédale branchée
js/music.js           les airs connus, arrangés à la volée
js/deezer.js          thèmes, recherche et chargement des extraits Deezer
js/audio.js           contexte audio partagé, mise à niveau du volume
api/deezer.js         relais vers l’API Deezer (elle refuse les appels directs d’un navigateur)
api/preview.js        relais des extraits MP3 (hébergés sur dzcdn.net uniquement)
api/resolve.js        lit les liens de partage raccourcis (link.deezer.com)
sw.js                 garde une copie de l’appli pour jouer hors ligne
```

Les trois fichiers du dossier `api/` sont des fonctions Vercel. Ils n’acceptent que les adresses Deezer prévues, rien d’autre.

Pour essayer en local avec les relais : `npx vercel dev`, puis ouvre l’adresse affichée.

Spotify n’est pas utilisable : ses conditions interdisent les jeux et quiz musicaux, et son API ne donne plus d’extraits aux nouvelles applis.

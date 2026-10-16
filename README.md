# Brouillé · le blind test qui déraille

Un blind test entre amis, sur un seul téléphone. Chacun son tour, on tire une carte, et l’extrait passe dans une pédale d’effet (hélium, à l’envers, disque rayé, karaoké…). Il faut trouver le titre avant la fin du disque.

## Deux modes

- **Automatique** : les morceaux sont tirés au sort dans la musique choisie, avec 4 niveaux de difficulté : Facile (les plus gros tubes), Moyen, Difficile et Expert (les chansons les plus pointues). Le niveau s’appuie sur la popularité des morceaux sur Deezer, à l’intérieur de la musique choisie.
- **Manuel** : un maître du jeu, qui ne joue pas, cherche à chaque tour le morceau à faire deviner sur Deezer et choisit sa pédale (ou Chaos, ou au hasard). Il peut aussi ajouter une 2e chanson pour faire un mashup. Puis il passe le téléphone au joueur, et c’est lui qui valide la réponse.

## Les cartes

| Carte | Ce qui se passe | Points |
| --- | --- | --- |
| Pédale | Une pédale déforme l’extrait. Le joueur répond à voix haute, les autres valident. | 2 |
| Chaos | Les pédales changent toutes les 3 secondes. | 3 |
| Chance | Quatre propositions s’affichent, il faut choisir la bonne. | 1 |
| Mashup | Deux chansons de deux styles différents, mélangées dans la même pédale. Il faut trouver les deux. | 2 par chanson |

En mode automatique, les styles des mashups se règlent avant la partie : tirés au hasard parmi les thèmes Deezer, choisis à la main (par exemple Rap français × Disney), ou pas de mashup du tout. Quand les mashups sont activés, il y en a au moins un par partie.

Une fois la réponse donnée, le bouton **Sans pédale** fait réécouter l’extrait d’origine (les deux, pour un mashup).

## La musique

- **Deezer** : thèmes tout prêts (Top du moment, Années 80, Rap français, Disney…), recherche de playlist, ou lien de playlist Deezer collé tel quel (le lien « Partager » de l’appli Deezer marche aussi). Ce sont les extraits officiels de 30 secondes, il faut une connexion internet.
- **Mon Deezer** : on relie son profil Deezer avec son pseudo ou le lien de son profil, sans mot de passe. Ses playlists publiques (Coups de cœur en premier) s’affichent pour jouer avec, et en mode manuel le maître du jeu peut y piocher des morceaux. L’appli ne lit que ce qui est public : une playlist privée n’apparaît pas. Le profil est retenu sur le téléphone, le bouton **Changer** l’oublie.
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
api/resolve.js        lit les liens de partage raccourcis (link.deezer.com) : playlist ou profil
sw.js                 garde une copie de l’appli pour jouer hors ligne
```

Les trois fichiers du dossier `api/` sont des fonctions Vercel. Ils n’acceptent que les adresses Deezer prévues, rien d’autre.

Pour essayer en local avec les relais : `npx vercel dev`, puis ouvre l’adresse affichée.

Spotify n’est pas utilisable, même pour se connecter : ses conditions pour les développeurs interdisent les jeux et les quiz, et le mélange avec un autre service. Pour jouer avec ses playlists Spotify, on les copie vers Deezer (avec un site comme TuneMyMusic ou Soundiiz), puis on relie son profil Deezer.

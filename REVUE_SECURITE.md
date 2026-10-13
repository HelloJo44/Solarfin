# 🔍 Revue sécurité & qualité — Solarfin

Revue faite le 13/10/2026 sur la branche `AppMobile` (la plus récente). Toutes les corrections sont dans la branche **`revue-securite`**. Tu peux les relire commit par commit et merger ce qui te convient.

---

## TL;DR

- **Rien de grave dans le code actuel** : pas de mot de passe, pas de token, ton email Git est bien masqué (`noreply`), et les images ne contiennent pas de métadonnées (EXIF/GPS).
- **Mais l'historique Git garde deux choses**, même si tu les as supprimées depuis : une **clé API TMDB** et l'**IP locale de ton serveur**. Voir la section 1 : une action de ta part est nécessaire pour la clé.
- Le code avait une vraie **faille XSS** : un titre de film piégé sur TMDB pouvait voler tes clés API. C'est corrigé et testé.
- Plusieurs bugs corrigés : les profils de qualité n'étaient jamais pris en compte par Seer, le mode hors ligne ne marchait pas, et le README s'affichait comme un bloc de code sur GitHub.

---

## 1. 🚨 Ce qui est visible publiquement (à traiter de ton côté)

> Supprimer un fichier ou une ligne ne l'efface pas de GitHub : n'importe qui peut remonter l'historique des commits.

### 🔴 Clé API TMDB dans l'historique

- **Où** : commit `6c0a6cd` ("Create Index.html"), ligne `tmdbKey: ... || '3d41f5a5…6b54'`. Tu l'as retirée dans `2fe19df`, mais elle reste lisible dans l'historique et dans la branche `Encryption`.
- **Risque** : faible (une clé TMDB ne donne accès qu'à des données publiques), mais quelqu'un peut consommer ton quota ou se faire bannir avec.
- **À faire** : si c'est ta clé, **régénère-la** sur <https://www.themoviedb.org/settings/api>. C'est la seule vraie solution. Réécrire l'historique (`git filter-repo` + `push --force`) ne sert à rien si la clé reste valide, car elle a pu être copiée ou mise en cache entre-temps.

### 🟡 IP locale du serveur dans l'historique

- **Où** : `http://192.168.1.2xx:5055` dans `default.conf` (commit `3152550`, remplacée par `XXX` ensuite) et `192.168.1.2xx:8080` dans le README (**retirée dans cette branche**).
- **Risque** : très faible. C'est une IP de réseau local (`192.168.x.x`), inaccessible depuis Internet. On apprend juste que tu as un Seer sur le port 5055.
- **À faire** : rien d'obligatoire. Désormais, l'IP se met dans un fichier `.env` qui n'est jamais envoyé sur GitHub (voir section 2).

### ✅ Vérifié et OK

- Aucun mot de passe, token ou clé Seer/Radarr/Sonarr dans les fichiers ni dans l'historique (toutes branches confondues).
- Email Git : `…@users.noreply.github.com`, donc ton adresse perso n'est pas exposée.
- `acceuil.png` / `portable.jpeg` : pas de métadonnées EXIF ni GPS.
- Pas de configuration d'indexeur, de tracker ou de client torrent dans le dépôt.

---

## 2. ✅ Ce que j'ai corrigé dans la branche `revue-securite`

### Sécurité

| Problème | Gravité | Correction |
|---|---|---|
| **XSS** : les titres et synopsis TMDB (modifiables par n'importe quel contributeur TMDB) étaient insérés tels quels dans la page via `innerHTML`. Un titre piégé pouvait exécuter du JavaScript et lire tes clés TMDB et Seer dans le `localStorage`. | 🔴 Haute | Ajout de `escapeHtml()` sur toutes les données externes (TMDB et noms de profils Seer). Même chose pour l'identifiant YouTube de la bande-annonce. **Testé** : un faux titre `<img onerror=…>` exécutait du code avant le correctif, plus après. |
| Les profils étaient récupérés via `/api/v1/settings/radarr` et `/sonarr`, qui renvoient aussi **les clés API de Radarr/Sonarr** au navigateur. | 🟠 Moyenne | Passage par `/api/v1/service/radarr` et `/sonarr` (ce qu'utilise l'interface d'Overseerr elle-même), qui ne renvoient que les profils. |
| La doc parlait de « stockage sécurisé / chiffrement XOR », mais la clé XOR est écrite dans le code : c'est du **brouillage**, pas du chiffrement. | 🟠 Moyenne | Commentaire honnête dans le code, avertissement dans les paramètres, et doc corrigée. |
| Tailwind chargé sans numéro de version (`cdn.tailwindcss.com`) : un script tiers qui peut changer à tout moment et qui a accès à tes clés. | 🟡 Faible | Version figée (`/3.4.17`). Font Awesome protégé par un hash d'intégrité (SRI). |
| IP du serveur écrite en dur dans `default.conf`. | 🟡 Faible | `default.conf` devient `default.conf.template` : l'IP vient de la variable `SEER_URL` définie dans `.env` (ignoré par Git). `.env.example` sert de modèle. |
| Pas d'en-têtes de sécurité HTTP. | 🟡 Faible | Ajout dans nginx de `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` et `server_tokens off`. |
| Clé TMDB affichée en clair dans les paramètres. | 🟡 Faible | Champ de type `password`, comme pour la clé Seer. |

### Bugs

| Problème | Correction |
|---|---|
| **Les profils de qualité choisis étaient ignorés** : le code envoyait `qualityProfileId`, mais Seer/Overseerr attend `profileId` (+ `serverId`). | Bon nom de champ, et le profil par défaut du serveur est présélectionné. |
| Le profil de langue ne s'affichait jamais (il n'est pas renvoyé par `/settings/sonarr`). | Récupéré via `/service/sonarr/{id}`. Envoyé uniquement pour les séries (Radarr n'a pas de profil de langue). |
| **Le Service Worker n'était jamais enregistré**, donc pas de mode hors ligne. | Enregistrement ajouté dans `index.html`. |
| `sw.js` mettait en cache `./Index.html` (avec une majuscule) alors que le fichier s'appelle `index.html`, et servait le cache en priorité : les mises à jour ne seraient jamais arrivées. | Réécrit en « réseau d'abord, cache en secours ». Les appels API ne passent plus jamais par le cache. |
| `manifest.json` : `start_url` pointait sur `./Index.html` (404 sous Linux/nginx), et il y avait une coquille `x1='0%ari'` dans l'icône. | `start_url: "./"`, coquille corrigée. |
| nginx mettait `index.html` et `sw.js` en cache 24 h : une mise à jour mettait jusqu'à un jour à arriver. | Plus de cache pour `index.html`, `sw.js` et `manifest.json`. Les autres fichiers gardent 1 jour. |
| `fetchWithRetry` réessayait aussi les erreurs 401/404. Avec une clé invalide, ça faisait environ 60 requêtes inutiles. | Réessaie seulement les erreurs 5xx et 429, avec un délai exponentiel (comme le dit la doc). |
| Image de remplacement hébergée sur `via.placeholder.com` (service tiers peu fiable). | Remplacée par une petite image SVG intégrée au code. |
| README : tout le contenu était dans un bloc ```` ```markdown ````, donc GitHub l'affichait comme du code brut. La 2ᵉ image ne s'affichait pas non plus. | Réécrit proprement, avec une section Installation (`.env`), une section Sécurité et le crédit TMDB. |
| `docker-compose.yml` : `build: ./solarfin` ne fonctionnait pas depuis le dépôt, et `version:` est obsolète. | `build: .` (commentaire pour le cas d'une stack existante) et `SEER_URL` obligatoire. |

### Qualité et accessibilité

- Suppression d'environ 230 lignes de code mort en commentaire (2 anciennes modales, 1 ancien `openDetailModal`, 3 anciens `sendRequest`). Elles restent dans l'historique Git si besoin.
- Zoom de nouveau possible sur mobile (`user-scalable=no` empêche les malvoyants de zoomer).
- Les cartes s'ouvrent au clavier (Entrée ou Espace), et les labels sont reliés à leurs champs.
- Liens externes en `rel="noopener noreferrer"`.
- **Mention TMDB** ajoutée en pied de page et dans le README : elle est **obligatoire** selon les conditions d'utilisation de l'API TMDB.

---

## 3. ⚠️ À tester de ton côté avant de merger

Je n'ai pas accès à ton serveur Seer, donc je n'ai pas pu tester l'envoi d'une vraie demande.

1. **Créer le `.env`** : `cp .env.example .env`, puis mettre ton `SEER_URL`. Sans ce fichier, `docker compose` refuse de démarrer (c'est voulu, pour ne pas lancer un proxy vers nulle part).
2. **Reconstruire** : `docker compose up -d --build solarfin`. J'ai vérifié en local que l'image se construit, que `nginx -t` passe et que les en-têtes sont bons.
3. Ouvrir une fiche film puis une fiche série : les **listes de profils** doivent se remplir avec tes profils Radarr/Sonarr.
4. Envoyer une demande avec un profil différent du profil par défaut, puis vérifier dans Seer qu'il a bien été pris en compte.
5. Après le premier chargement, faire un **rechargement forcé** (Ctrl+F5) pour que le nouveau Service Worker s'installe.

Les clés déjà enregistrées dans le navigateur restent compatibles : pas besoin de les ressaisir.

---

## 4. 💡 Pistes d'amélioration (non faites, à toi de voir)

### Sécurité

- **Ne jamais exposer Solarfin directement sur Internet.** La clé API Seer donne les droits **administrateur** : toute personne qui l'obtient peut modifier tes réglages Seer, supprimer des utilisateurs, etc. Pour un accès à distance, passe plutôt par un VPN, Tailscale ou WireGuard, ou mets une authentification devant (Authelia, Authentik…).
- **Option « zéro clé dans le navigateur »** : nginx peut ajouter la clé Seer lui-même. Le navigateur ne la voit alors plus jamais (et elle n'est plus volable par XSS) :

  ```nginx
  # default.conf.template, dans location /api/
  proxy_set_header X-Api-Key ${SEER_API_KEY};
  ```

  Ajoute ensuite `SEER_API_KEY` dans `.env` et dans `environment:` du compose, puis laisse le champ clé vide dans l'app. ⚠️ Contrepartie : tout appareil qui peut joindre le port 8080 aura les droits admin sur Seer. Ne le fais donc que si l'accès est limité à ton réseau ou à ton VPN.
- **Tailwind « Play CDN »** : Tailwind précise lui-même qu'il n'est pas fait pour la production (il compile le CSS dans le navigateur à chaque chargement). La version figée limite le risque, mais l'idéal est de générer un vrai fichier CSS avec la CLI Tailwind. Ça permettrait aussi d'ajouter une `Content-Security-Policy` stricte.
- Remplacer les `onclick="..."` dans le HTML par des `addEventListener`, ce qui est aussi nécessaire pour une CSP stricte.
- Figer la version de l'image Docker (`nginx:1.27-alpine` plutôt que `nginx:alpine`) pour des builds reproductibles.

### Fonctionnel

- **Fausse plateforme affichée** : quand TMDB ne connaît pas de plateforme pour un titre, `getFallbackPlatformKey()` en choisit une au hasard d'après l'ID. Résultat : un badge « Netflix » peut s'afficher sur un film qui n'y est pas. Mieux vaut afficher « Non disponible en streaming » ou rien.
- **Sources de recommandations** : seule « TMDB Tendances » fait réellement quelque chose. Télérama, SensCritique, BetaSeries, etc. sont des boutons sans effet. Tu pourrais les masquer ou les marquer « bientôt ».
- Le fournisseur TMDB est récupéré avec `data.results.FR || data.results` : quand il n'y a pas d'entrée `FR`, l'objet de **tous les pays** est passé et rien n'est trouvé. Autant ne garder que `FR`.
- La pagination (« Charger plus ») est listée comme faite dans la doc mais n'existe pas : je l'ai remise en « à faire ».
- Nom de l'app un peu mélangé : « Overseerr / Moonfin » dans les paramètres, « Seer » ailleurs.

### Dépôt

- `acceuil.png` → `accueil.png` (faute d'orthographe).
- `portable.jpeg` est une maquette (« Continue Watching », barre de navigation…), pas une vraie capture : je l'ai légendée « maquette » dans le README pour ne pas induire en erreur.
- La bannière `solarfin_banner.gif` pèse 3,6 Mo. Une version `.webp` ou `.mp4` serait beaucoup plus légère.
- `main` est en retard sur `AppMobile` (Docker, nginx, profils Seer). Pense à merger `AppMobile` dans `main` quand tu es satisfait.

---

*Revue réalisée avec l'aide de Claude Code, à la demande d'Edouard.*

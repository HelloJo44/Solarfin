# 🧒 Onglet « Enfants » — architecture et logique

Ce document répond au cahier des charges de l'onglet Enfants : classification par âge, statut « Déjà vu » / « Aimé », recommandations par affinité et note TMDB.

---

## 1. Ce que voit l'utilisateur

- Un 3ᵉ bouton **Enfants** dans l'en-tête, à côté de Films / Séries. L'onglet ne contient que des **films**.
- **Âge de l'enfant** : `3+` · `6+` · `9+` · `12+`. Choisir `6+` affiche les films classés 3+ **et** 6+, c'est-à-dire tout ce qui est adapté jusqu'à 6 ans.
- **Mes films** :
  - **Catalogue** : films familiaux et d'animation populaires, classés par âge.
  - **Pour toi** : recommandations calculées à partir des films aimés, chacune avec sa raison (« Parce que tu as aimé *Vaiana* »). Une ligne « À partir de » permet de partir de **tous les favoris** ou d'**un seul film aimé**.
  - **Déjà vus** / **Aimés** : l'historique, du plus récent au plus ancien.
- Chaque carte affiche la **tranche d'âge** (un `*` signale une estimation), la **note TMDB** ★, et les icônes 👁 (vu) et ❤ (aimé).
- La fiche d'un film a deux boutons, **Déjà vu** et **J'aime**, ainsi que la source de la classification (ex : « Classification officielle : NL 6 »).
- Les filtres existants (recherche, plateformes, genres) restent actifs dans toutes les vues. Les genres inadaptés (Horreur, Thriller, Policier, Guerre) sont masqués.

---

## 2. Architecture

```text
index.html                         kids.js (logique pure, testée)
───────────                        ────────────────────────────────
switchMediaType('kids')            classifyAge()        ← certifications TMDB → 3/6/9/12
  └─ loadKidsCatalogue()           loadState/saveState  ← historique localStorage
       ├─ TMDB /discover/movie     setSeen / setLiked   ← règles "aimé ⇒ vu"
       └─ classifyKidsItems() ───► buildTasteProfile()  ← profil de goût
            └─ fetchKidsMovieDetails()   scoreCandidate() ← score d'affinité
setKidsView('reco')                recommend()          ← classement final + raison
  └─ computeKidsRecommendations() ─┘
applyFilters() → renderGrid()      (âge, plateforme, genre, recherche)
```

- **`kids.js`** contient uniquement de la logique : aucun accès au DOM ni au réseau. On peut donc la tester avec Node (`node --test tests/`).
- **`index.html`** gère l'affichage et les appels TMDB. Il réutilise `fetchWithRetry`, `escapeHtml`, la carte et la fiche détail existantes.
- **Une seule requête TMDB par film** : `/movie/{id}?append_to_response=release_dates,keywords,watch/providers` donne d'un coup la certification, les mots-clés et les plateformes. Les résultats sont mis en cache pour la session et les requêtes sont limitées à 8 en parallèle.

---

## 3. Structure des données

### Aujourd'hui : stockage dans le navigateur

Une clé `localStorage` **`solarfin_kids_v1`** :

```json
{
  "version": 1,
  "maxAge": 6,
  "view": "reco",
  "movies": {
    "277834": {
      "seen": true,
      "liked": true,
      "seenAt": 1791915515676,
      "likedAt": 1791915515676,
      "item": {
        "id": 277834, "title": "Vaiana, la légende du bout du monde",
        "poster": "https://image.tmdb.org/t/p/w500/….jpg", "year": "2016",
        "rating": "7.6", "voteAverage": 7.6, "voteCount": 12000,
        "genre_ids": [16, 12, 10751], "keywordIds": [1159, 3799],
        "ageBand": 6, "ageEstimated": false, "ageSource": "NL 6",
        "platformKeys": ["disney"]
      }
    }
  }
}
```

- **Une entrée existe uniquement si le film a été vu.** La règle « aimé ⇒ vu » est donc garantie par la structure elle-même : marquer « pas vu » supprime l'entrée, et le « aimé » avec.
- `item` est une copie des infos du film (genres, mots-clés, âge, note). Elle permet d'afficher l'historique et de calculer les recommandations **sans rappeler TMDB**.
- `version` permet de faire évoluer le format plus tard. Un contenu corrompu ou inconnu est ignoré sans faire planter l'app.

### Plus tard : base de données (si un backend arrive, cf. v3.0 de la doc)

Même modèle, avec en plus des **profils enfants** (plusieurs enfants d'âges différents) :

```sql
CREATE TABLE child_profile (
    id            INTEGER PRIMARY KEY,
    name          TEXT     NOT NULL,
    max_age_band  SMALLINT NOT NULL DEFAULT 12 CHECK (max_age_band IN (3, 6, 9, 12)),
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Cache des métadonnées TMDB (rafraîchi si fetched_at est trop ancien)
CREATE TABLE movie (
    tmdb_id        INTEGER PRIMARY KEY,
    title          TEXT NOT NULL,
    poster_path    TEXT,
    release_year   SMALLINT,
    vote_average   REAL,
    vote_count     INTEGER,
    age_band       SMALLINT CHECK (age_band IN (3, 6, 9, 12)),  -- NULL = non adapté aux enfants
    age_source     TEXT,                                        -- 'NL 6', 'estimé (genres)'…
    age_estimated  BOOLEAN NOT NULL DEFAULT FALSE,
    fetched_at     TIMESTAMP NOT NULL
);
CREATE TABLE movie_genre   (tmdb_id INTEGER REFERENCES movie ON DELETE CASCADE, genre_id   INTEGER, PRIMARY KEY (tmdb_id, genre_id));
CREATE TABLE movie_keyword (tmdb_id INTEGER REFERENCES movie ON DELETE CASCADE, keyword_id INTEGER, PRIMARY KEY (tmdb_id, keyword_id));

-- Une ligne = un film vu par un enfant ; liked_at non NULL = aimé (donc aimé ⇒ vu)
CREATE TABLE viewing (
    profile_id  INTEGER REFERENCES child_profile ON DELETE CASCADE,
    tmdb_id     INTEGER REFERENCES movie,
    seen_at     TIMESTAMP NOT NULL,
    liked_at    TIMESTAMP,
    PRIMARY KEY (profile_id, tmdb_id)
);
CREATE INDEX viewing_liked ON viewing (profile_id, liked_at) WHERE liked_at IS NOT NULL;
```

---

## 4. Classification par âge

TMDB fournit les certifications **par pays** (`release_dates`). On convertit chaque certification en âge minimum, puis on arrondit à la tranche supérieure (8 ans → `9+`). Au-delà de 12 ans, le film est **exclu** de l'onglet.

| Pays (ordre de priorité) | Certifications → âge minimum | Pourquoi |
|---|---|---|
| 🇳🇱 Pays-Bas (Kijkwijzer) | AL→0, 6, 9, 12, 14, 16, 18 | Grille la plus fine, colle exactement aux tranches 3/6/9/12 |
| 🇩🇪 Allemagne (FSK) | 0, 6, 12, 16, 18 | Très bien renseignée sur TMDB |
| 🇬🇧 Royaume-Uni (BBFC) | U→4, PG→8, 12A/12→12, 15, 18 | Bonne couverture |
| 🇫🇷 France (CNC) | U→**6**, 10, 12, 16, 18 | « Tous publics » couvre des films très variés, donc on reste prudent |
| 🇺🇸 États-Unis (MPA) | G→0, PG→8, PG-13→13, R→17 | Couverture quasi totale, mais grille grossière |

- On prend le **premier pays de la liste** qui a une certification connue, en préférant la date de sortie cinéma. Une certification vide ou inconnue (`NR`…) fait passer au pays suivant.
- **Sans aucune certification** : si le film est « Familial » ou « Animation » et n'est **pas** Horreur, Thriller, Policier ou Guerre, il est estimé à **`6+*`** (l'astérisque est affiché). Sinon, il est exclu.
- Exemples : NL `AL` → **3+** · DE `6` → **6+** · GB `PG` → **9+** · FR `10` → **12+** · US `PG-13` → exclu.

---

## 5. Logique de filtrage

Pour chaque vue, `applyFilters()` applique dans l'ordre :

1. **Source** : catalogue, recommandations (sans les films marqués vus entre-temps), vus ou aimés.
2. **Recherche** : titre contenant le texte saisi.
3. **Âge** : `ageBand ≤ âge choisi`. Les films sans tranche ne sont jamais affichés.
4. **Plateforme** : seules les vraies plateformes TMDB (France) sont utilisées, sans plateforme inventée. Un film sans plateforme connue n'est masqué que si le filtre plateforme est actif (c'est-à-dire si toutes les plateformes ne sont pas cochées).
5. **Genres** : au moins un des genres choisis.

---

## 6. Recommandations basées sur les films « Aimés »

### Candidats

- Les films du catalogue enfants.
- Les **recommandations TMDB** (`/movie/{id}/recommendations`) des **5 films aimés les plus récents**, ou du seul film choisi dans « À partir de ». C'est le signal de type « les gens qui ont aimé X ont aussi aimé Y ».
- Sont **exclus** : les films déjà vus ou aimés, et ceux qui ne sont pas adaptés (classification > 12 ans).

### Profil de goût

Pour chaque genre et chaque mot-clé TMDB : **poids = part des films aimés qui le contiennent**. Si 2 films aimés sur 3 sont « Aventure », le poids d'Aventure vaut 0,67.

### Score de chaque candidat (entre 0 et 1)

```text
score = 0.35 × TMDB      (combien de films aimés le recommandent, plafonné à 3)
      + 0.25 × Genres    (similarité cosinus genres du film ↔ profil)
      + 0.25 × Mots-clés (similarité cosinus mots-clés du film ↔ profil)
      + 0.15 × Qualité   (note TMDB bayésienne, ramenée sur [0, 1])
```

- **Note bayésienne** : `(v / (v + 150)) × note + (150 / (v + 150)) × 6.5`. Un 9/10 sur 3 votes ne passe donc pas devant un 8/10 sur 10 000 votes.
- Un candidat **sans aucun lien** avec les goûts (TMDB, genres et mots-clés tous à 0) est écarté : une bonne note seule ne fait pas une recommandation.
- **La raison** affichée est le film aimé qui recommande ce candidat sur TMDB. À défaut, c'est le film aimé qui partage le plus de genres et de mots-clés avec lui (un mot-clé compte double).
- **Performance** : on pré-classe d'abord sans mots-clés, puis on ne demande les détails TMDB que des **30 meilleurs**. Au total, cela fait au plus 5 + 30 requêtes, et les films du catalogue sont déjà en cache.
- Les recommandations sont recalculées en arrivant sur « Pour toi » (si l'historique a changé) ou en changeant de film de départ, **pas à chaque clic** sur « J'aime ». Marquer un film « Déjà vu » depuis « Pour toi » le retire tout de suite de la liste.

Les poids sont regroupés dans `SCORE_WEIGHTS` (`kids.js`) pour être faciles à ajuster.

---

## 7. Tests

```bash
node --test tests/
```

`tests/kids.test.js` contient 15 tests qui couvrent :
- la conversion des certifications en tranches d'âge, la priorité entre pays, l'estimation d'âge et les exclusions ;
- la règle « aimé ⇒ vu », la sauvegarde et la relecture de l'historique, ainsi que la résistance à des données corrompues ;
- la similarité, la note bayésienne, le classement des recommandations, l'exclusion des films vus ou trop âgés, et la raison affichée.

Le parcours complet a aussi été testé dans un navigateur (Edge headless) avec une API TMDB simulée : passage dans l'onglet, filtre d'âge, « J'aime », vue « Pour toi », « Déjà vu », historique, recherche et retour à l'onglet Films. Aucune erreur JavaScript n'est apparue.

---

## 8. Limites et pistes

- **L'historique est propre à chaque appareil et navigateur** : il n'y a pas de synchronisation, et il n'existe qu'un seul profil. Le schéma SQL ci-dessus prévoit plusieurs profils enfants pour le jour où un backend existe.
- La classification dépend de TMDB : certains films récents ou rares n'ont aucune certification et sont donc estimés ou exclus. Une **correction manuelle par le parent** (« ce film est OK pour 6 ans ») serait un bon ajout.
- Le catalogue enfants charge 2 pages TMDB (environ 40 films populaires). Un bouton « Charger plus » ou une recherche TMDB directe (`/search/movie`) élargirait le choix.
- Le signal « vu mais pas aimé » n'est pas utilisé comme signal négatif, conformément au cahier des charges (historique **positif**). C'est une piste si les recommandations se révèlent trop répétitives.

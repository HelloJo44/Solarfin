# 📋 Documentation - StreamHub (Solarfin)

**Version:** 1.0  
**Description:** Interface web pour catalogue de films et séries avec recommandations, filtrage par plateforme et intégration Overseerr/Moonfin.

---

## 📑 Table des matières
1. [Vue d'ensemble](#vue-densemble)
2. [Fonctionnalités actuelles](#fonctionnalités-actuelles)
3. [Architecture technique](#architecture-technique)
4. [Flux utilisateur](#flux-utilisateur)
5. [Configuration requise](#configuration-requise)
6. [Prochaines évolutions](#prochaines-évolutions)
7. [Problèmes connus & améliorations](#problèmes-connus--améliorations)

---

## 🎬 Vue d'ensemble

**StreamHub** est une interface de surf de catalogues de films et séries. Elle permet aux utilisateurs de :
- Explorer les tendances TMDB
- Filtrer par plateforme de streaming (Netflix, Prime, Disney+, Apple TV+, Canal+, Paramount+, **OCS**, **HBO**)
- Filtrer par genres et thématiques
- Rechercher des titres
- Consulter les bandes-annonces
- Envoyer des demandes vers Overseerr/Moonfin pour les ajouter à la watchlist

**Plateforme:** Site HTML/CSS/JavaScript pur (SPA - Single Page Application)  
**Dépendances externes:** 
- API TMDB v3 (themoviedb.org)
- API Overseerr/Moonfin
- Tailwind CSS (CDN)
- FontAwesome Icons (CDN)

---

## ✨ Fonctionnalités actuelles

### 1. **Navigation & Interface générale**
- **Header sticky** avec logo "StreamHub"
- **Toggle Films/Séries** pour basculer entre les deux types de contenu
- **Bouton Paramètres** pour accéder à la configuration (gear icon)
- **Thème sombre** activé par défaut avec couleurs personnalisées

### 2. **Recherche**
- **Barre de recherche** en temps réel
- Filtre par titre (case-insensitive)
- Met à jour le catalogue instantanément

### 3. **Recommandations (Sources)**
Multi-sélection de sources de recommandations différentes selon le type :

#### **Films:**
- TMDB Tendances
- Inspiré de votre séance
- Télérama Sorties
- SensCritique Top
- Presse & Médias

#### **Séries:**
- Tendances Séries
- BetaSeries Sorties
- SensCritique Séries
- Allociné Séries
- TV Guide

**Fonctionnement:** Au minimum 1 source doit être sélectionnée. Affiche le compteur des sources sélectionnées.

### 4. **Filtrage par plateforme** ⭐ [MISE À JOUR]
Plateforme avec IDs TMDB associés :
- **Netflix** (ID: 8) - Badge rouge
- **Prime Video** (ID: 9) - Badge cyan
- **Disney+** (ID: 337) - Badge bleu
- **Apple TV+** (ID: 350) - Badge gris
- **Canal+** (ID: 381) - Badge ambre
- **Paramount+** (ID: 531) - Badge bleu foncé
- **OCS** (ID: À déterminer) - Badge à définir 🆕
- **HBO** (ID: À déterminer) - Badge à définir 🆕

**Bouton "Tout/Aucun"** pour sélectionner/désélectionner toutes les plateformes en une action.
**Filtrage réel:** Chaque titre possède un `platformKey` qui doit correspondre à une plateforme sélectionnée.

### 5. **Filtrage par genres & thématiques**
Genres dynamiques selon le type de contenu :

#### **Films (17 genres):**
Action, Aventure, Animation, Comédie, Policier, Documentaire, Drame, Famille, Fantastique, Histoire, Horreur, Mystère, Romance, Sci-Fi, Thriller, Guerre, Western

#### **Séries (16 genres):**
Action & Aventure, Animation, Comédie, Crime, Documentaire, Drame, Famille, Kids, Mystère, News, Reality, Sci-Fi & Fantasy, Soap, War & Politics, Western

**Fonctionnement:** 
- Bouton "Tous" pour inclure tous les genres
- Sélection multiple avec ajout/suppression dynamique
- Si aucun genre n'est sélectionné, "Tous" est réactivé automatiquement

### 6. **Catalogue & Grille de médias**
- Affichage grid responsive (2 colonnes mobile, 3-5 colonnes desktop)
- **Cartes de média** avec :
  - Image d'affiche
  - Badge plateforme (couleur codée)
  - Badge note (★ rating TMDB)
  - Titre du contenu
  - Année de sortie
  - Synopsis (preview sur 2 lignes avec effet gradient)
  - Animation hover (zoom de l'image)

### 7. **Modale détails & requête**
Au clic sur une carte :
- **Backdrop** (image de fond)
- **Titre, Année, Note**
- **Badge plateforme** coloré
- **Genres** affichés en badges
- **Synopsis complet**
- **Bouton "Bande-annonce"** → ouvre la modale trailer
- **Bouton "Envoyer à Overseerr/Moonfin"** → envoie la demande

### 8. **Modale Bande-annonce**
- Recherche de la bande-annonce YouTube (français en priorité)
- Affichage dans un iframe YouTube avec autoplay
- Message si aucune bande-annonce disponible
- Fermeture avec bouton X

### 9. **Paramètres**
Modale pour configurer :
- **Clé API TMDB** (sauvegardée en localStorage)
- **URL du serveur Overseerr/Moonfin** (format: https://overseerr.example.com)
- **Clé API Overseerr/Moonfin**
- Bouton "Enregistrer les paramètres"

**Stockage:** localStorage avec clés `streamhub_tmdb`, `streamhub_url`, `streamhub_key`

### 10. **Intégration Overseerr/Moonfin**
- Appel POST à `/api/v1/request`
- Paramètres envoyés: `mediaType` et `mediaId`
- Authentification via header `X-Api-Key`
- Messages de succès/erreur avec alert()

### 11. **Compteurs & Feedback**
- **Compteur de sources** : "X sélectionnée(s)"
- **Compteur de résultats** : "X résultat(s)"
- **Message d'état** : Spinner pendant le chargement, message si 0 résultats

---

## 🏗️ Architecture technique

### **Structure du fichier:**
- **HTML:** En-têtes, sections, modales
- **CSS (Tailwind):** Styling responsive, thème sombre, animations
- **JavaScript:** Logic, état global, API calls

### **État global (State):**
```javascript
currentMediaType    // 'movie' ou 'tv'
selectedSources     // Set de sources actives
selectedPlatforms   // Set de plateformes actives
selectedGenres      // Set de genres actifs
searchQuery         // String de recherche
mediaCache          // Array d'objets média
lastRequestedItem   // Dernier item cliqué
config              // { tmdbKey, serverUrl, serverKey }
```

### **Données référence:**
- `platformData` : Nom, couleur, ID TMDB de chaque plateforme
- `genreMap` : ID TMDB → Label pour films et séries
- `sourcesConfig` : Sources disponibles par type

### **Fonctions principales:**
| Fonction | Rôle |
|----------|------|
| `loadCatalogue()` | Fetch TMDB trending, remplit mediaCache |
| `applyFilters()` | Filtre mediaCache selon critères actifs |
| `renderGrid(items)` | Affiche les cartes dans la grille |
| `openDetailModal(id)` | Affiche modale détails |
| `openTrailer(id)` | Fetch & affiche bande-annonce |
| `sendRequest(id)` | POST vers Overseerr/Moonfin |
| `togglePlatform(key)` | Activer/désactiver une plateforme |
| `setGenre(id)` | Gérer sélection genres |
| `toggleSource(id)` | Gérer sélection sources |

---

## 🔄 Flux utilisateur

```
1. Utilisateur ouvre l'application
   ↓
2. Page charge, initialise sources/genres/plateformes par défaut
   ↓
3. TMDB est interrogée → Catalogue rempli
   ↓
4. Utilisateur peut :
   a) Chercher un titre → Filtre appliqué en temps réel
   b) Cocher/décocher sources, genres, plateformes → applyFilters() appelé
   c) Cliquer sur une carte → Modale détails ouvre
   d) Cliquer "Bande-annonce" → Modale trailer affiche YouTube
   e) Cliquer "Envoyer à Overseerr/Moonfin" → API POST appelée
   f) Cliquer "Paramètres" → Config ouverte, changements sauvegardés en localStorage
```

---

## ⚙️ Configuration requise

### **Pour déployer l'application:**
1. **Clé API TMDB** (gratuite sur https://www.themoviedb.org/settings/api)
   - Utilise l'API v3
   - Endpoints utilisés : `/trending/{type}/week`, `/{type}/{id}/videos`

2. **Instance Overseerr/Moonfin** (optionnel pour demandes)
   - URL accessible
   - Clé API avec droits de création de demandes

3. **Serveur statique** ou GitHub Pages
   - Le fichier `Index.html` peut être servi directement
   - Pas de backend requis (sauf pour Overseerr/Moonfin)

### **Détails API TMDB:**
- **Base URL:** `https://api.themoviedb.org/3`
- **Format images:** `https://image.tmdb.org/t/p/{size}/{path}`
- **Langues:** `fr-FR` en priorité, fallback `en`

---

## 🚀 Prochaines évolutions possibles

### **Court terme (v1.1):**

1. **Amélioration filtrage plateformes:**
   - ✅ Ajouter OCS et HBO dans la liste
   - Vérifier que le filtrage fonctionne bien pour ces nouvelles plateformes
   - Trouver les IDs TMDB corrects pour OCS et HBO
   - Tester le filtrage catalog avec ces plateformes
   - Ajouter badges couleur uniques pour OCS et HBO

2. **Persistance des sélections:**
   - Sauvegarder en localStorage : sources sélectionnées, genres, plateformes
   - Restaurer au rechargement de la page

3. **Meilleure gestion des erreurs API:**
   - Retry automatique en cas d'échec
   - Messages d'erreur plus détaillés
   - Fallback sur données en cache si API indisponible

### **Moyen terme (v1.2-1.3):**

4. **Système de notation & favoris:**
   - Cœur à cocher sur chaque carte → Sauvegarde en localStorage
   - Voir ses favoris (section dédiée)
   - Exporter/importer liste de favoris

5. **Historique personnel:**
   - Tracker les films/séries consultées
   - Recommander basé sur historique
   - Suggestions AI simplistes (co-occurrences de genres/acteurs)

6. **Support multi-sources API:**
   - Intégrer BetaSeries API (pour séries)
   - Intégrer SensCritique API
   - Agrégation des notes (moyenne TMDB + BetaSeries)

7. **Filtres avancés:**
   - Par année (slider de dates)
   - Par note minimale (slider)
   - Par pays de production
   - Par langue originale

8. **Sharing & Social:**
   - Copier lien vers une sélection de filtres
   - Générer QR code
   - Partager la liste de favoris (URL encodée)

### **Long terme (v2.0):**

9. **Backend léger (Node.js / Python):**
   - Cache des requêtes TMDB
   - Agrégation multi-sources
   - Gestion des profils utilisateur
   - Base de données (SQLite/PostgreSQL) pour favoris/historique

10. **Application mobile (React Native / Flutter):**
    - Même interface sur Android/iOS
    - Notifications de nouvelles sorties
    - Watchlist synchronisée

11. **Intégrations avancées:**
    - Affichage direct des prix de location/achat (JustWatch API)
    - Support des réseaux sociaux (Reddit, Twitter trends)
    - Calendrier des sorties par semaine
    - Alertes personnalisées (nouveau contenu favori)

12. **Interface utilisateur:**
    - Mode clair/sombre toggle
    - Personnalisation des couleurs
    - Différentes mises en page (list, grid, carousel)
    - Animations améliorées

---

## 🐛 Problèmes connus & améliorations

### **Problèmes identifiés:**

1. **Attribution plateforme:** 
   - Actuellement, chaque titre reçoit une plateforme "random" basée sur son ID
   - ❌ Ne reflète pas la réalité (un film n'est pas vraiment sur Netflix juste parce que son ID modulo)
   - ✅ **Solution future:** Interroger l'API TMDB `/watch/providers` pour chaque titre

2. **Sources non implémentées:**
   - Les sources (Télérama, SensCritique, etc.) ne font que des noms
   - ❌ Pas d'intégration réelle avec ces APIs externes
   - ✅ **Solution future:** Développer scrapers/API adapters pour chaque source

3. **Pagination:**
   - ❌ Pas de pagination sur les résultats TMDB (limité à première page)
   - ✅ **Solution:** Ajouter "Charger plus" ou pagination infinie

4. **Performance:**
   - Aucun debouncing sur la recherche (peut ralentir sur beaucoup de résultats)
   - ✅ **Solution:** Implémenter debounce avec délai (300ms)

5. **Accessibilité:**
   - Pas d'attributs ARIA
   - ✅ **Solution:** Ajouter `role`, `aria-label`, `aria-pressed` sur boutons

6. **Responsive design:**
   - ❌ Interface peut être cramée sur très petit écrans
   - ✅ **Solution:** Ajuster breakpoints Tailwind, réduire padding/gaps

### **Recommandations de code:**

- Refactoriser en modules ES6 (import/export)
- Utiliser fetch avec timeout
- Ajouter service worker pour PWA (offline mode)
- Tester avec outils d'accessibilité (Lighthouse, axe DevTools)
- Minifier CSS/JS avant production
- Ajouter headers CORS sur le backend Overseerr si cross-origin

---

## 📊 Statistiques du projet

| Métrique | Valeur |
|----------|--------|
| Lignes de code | ~590 |
| Langages | HTML, CSS (Tailwind), JavaScript |
| API externes | 1 (TMDB) + optionnel (Overseerr) |
| Dépendances | 2 (Tailwind CDN, FontAwesome CDN) |
| Taille fichier | ~32 KB (Index.html) |
| Complexité | Basse (SPA simple) |

---

## 📞 Support & Contact

**Auteur:** HelloJo44  
**Repository:** https://github.com/HelloJo44/Solarfin  
**License:** MIT  
**Version:** 1.0 (2026-10-10)

---

## ✅ Checklist pour relancer une conversation Copilot

Avant de relancer une conversation avec Copilot, assurez-vous d'avoir :

- [ ] Lu cette documentation complète
- [ ] Identifié la fonctionnalité ou évolution à implémenter
- [ ] Noté les IDs TMDB des nouvelles plateformes (OCS, HBO)
- [ ] Testé le filtrage catalog avec ces plateformes
- [ ] Préparé des exemples d'utilisation
- [ ] Documenté les erreurs/bugs à fixer
- [ ] Défini la priorité (court/moyen/long terme)

**Format recommandé pour relancer Copilot:**
```
Je veux implémenter [FEATURE] sur l'application StreamHub.
Contexte: [DESCRIPTION COURTE]
Détails techniques: [REQUIS SPÉCIFIQUES]
Prioriser: [COURT/MOYEN/LONG TERME]
```

---

**Dernière mise à jour:** 2026-10-10

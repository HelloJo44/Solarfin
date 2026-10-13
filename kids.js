// Onglet "Enfants" : classification par âge, historique (déjà vu / aimé) et recommandations.
// Ce fichier ne contient que de la logique pure (aucun accès au DOM ni au réseau) pour pouvoir
// être testé avec Node : `node --test tests/`. Voir docs/ONGLET_ENFANTS.md pour l'architecture.
(function (root) {
    'use strict';

    // ---------------------------------------------------------------------------------------------
    // 1. Classification par âge
    // ---------------------------------------------------------------------------------------------

    const AGE_BANDS = [3, 6, 9, 12];
    const MAX_KIDS_AGE = AGE_BANDS[AGE_BANDS.length - 1];

    // Âge minimum (en années) correspondant à chaque certification TMDB, par pays.
    const CERTIFICATION_AGES = {
        // Pays-Bas (Kijkwijzer) : la grille la plus fine (AL, 6, 9, 12...), donc prioritaire
        NL: { AL: 0, '6': 6, '9': 9, '12': 12, '14': 14, '16': 16, '18': 18 },
        // Allemagne (FSK)
        DE: { '0': 0, '6': 6, '12': 12, '16': 16, '18': 18 },
        // Royaume-Uni (BBFC) : U = "à partir de 4 ans", PG = "à partir de 8 ans" environ
        GB: { U: 4, PG: 8, '12A': 12, '12': 12, '15': 15, '18': 18, R18: 18 },
        // France (CNC) : "Tous publics" couvre des films très variés, donc on reste prudent (6 ans)
        FR: { U: 6, TP: 6, '10': 10, '12': 12, '16': 16, '18': 18 },
        // États-Unis (MPA)
        US: { G: 0, PG: 8, 'PG-13': 13, R: 17, 'NC-17': 18 }
    };
    const CERTIFICATION_PRIORITY = ['NL', 'DE', 'GB', 'FR', 'US'];

    const GENRE_ANIMATION = 16;
    const GENRE_FAMILY = 10751;
    // Genres qui excluent un film de l'estimation "enfant" quand aucune certification n'existe
    const NOT_FOR_KIDS_GENRES = [27, 53, 80, 10752]; // Horreur, Thriller, Policier, Guerre

    function certificationToAge(country, certification) {
        const table = CERTIFICATION_AGES[country];
        if (!table || !certification) return null;
        const age = table[String(certification).trim().toUpperCase()];
        return age === undefined ? null : age;
    }

    // Plus petite tranche qui couvre l'âge demandé (ex : 8 ans -> 9+). Au-delà de 12 : null (hors onglet).
    function ageToBand(age) {
        if (age === null || age === undefined) return null;
        const band = AGE_BANDS.find(b => age <= b);
        return band === undefined ? null : band;
    }

    // Certification d'un pays dans la réponse TMDB "release_dates" (sortie cinéma en priorité)
    function pickCertification(countryEntry) {
        const dates = (countryEntry && countryEntry.release_dates) || [];
        const withCert = dates.filter(d => d.certification && d.certification.trim());
        const theatrical = withCert.find(d => d.type === 3 || d.type === 2);
        const chosen = theatrical || withCert[0];
        return chosen ? chosen.certification.trim() : null;
    }

    // Renvoie { band: 3|6|9|12|null, source, estimated }. band === null : film non adapté (ou inconnu).
    function classifyAge(releaseDatesResults, genreIds) {
        const results = Array.isArray(releaseDatesResults) ? releaseDatesResults : [];
        for (const country of CERTIFICATION_PRIORITY) {
            const certification = pickCertification(results.find(r => r.iso_3166_1 === country));
            const age = certificationToAge(country, certification);
            if (age !== null) {
                return { band: ageToBand(age), source: `${country} ${certification}`, estimated: false };
            }
        }
        // Aucune certification exploitable : estimation prudente à partir des genres
        const genres = genreIds || [];
        const looksFamily = genres.includes(GENRE_FAMILY) || genres.includes(GENRE_ANIMATION);
        const looksUnsafe = genres.some(g => NOT_FOR_KIDS_GENRES.includes(g));
        if (looksFamily && !looksUnsafe) {
            return { band: 6, source: 'estimé (genres)', estimated: true };
        }
        return { band: null, source: 'inconnu', estimated: true };
    }

    // ---------------------------------------------------------------------------------------------
    // 2. Historique : "Déjà vu" et "Aimé" (stocké dans le navigateur)
    // ---------------------------------------------------------------------------------------------

    const STORAGE_KEY = 'solarfin_kids_v1';
    const VIEWS = ['catalogue', 'reco', 'seen', 'liked'];

    function defaultState() {
        return { version: 1, maxAge: MAX_KIDS_AGE, view: 'catalogue', movies: {} };
    }

    function loadState(storage) {
        const state = defaultState();
        try {
            const raw = storage && storage.getItem(STORAGE_KEY);
            const saved = raw ? JSON.parse(raw) : null;
            if (!saved || saved.version !== 1) return state;
            if (AGE_BANDS.includes(saved.maxAge)) state.maxAge = saved.maxAge;
            if (VIEWS.includes(saved.view)) state.view = saved.view;
            if (saved.movies && typeof saved.movies === 'object') {
                for (const [id, entry] of Object.entries(saved.movies)) {
                    if (entry && entry.item && Number(entry.item.id) === Number(id)) state.movies[id] = entry;
                }
            }
        } catch (e) {
            // Données corrompues ou stockage indisponible : on repart d'un état vide
        }
        return state;
    }

    function saveState(storage, state) {
        try {
            storage.setItem(STORAGE_KEY, JSON.stringify(state));
            return true;
        } catch (e) {
            return false;
        }
    }

    // Copie des infos utiles d'un film, pour afficher l'historique et recommander sans rappeler TMDB
    function snapshotItem(item) {
        return {
            id: Number(item.id),
            title: item.title || '',
            overview: item.overview || '',
            poster: item.poster || '',
            backdrop: item.backdrop || '',
            rating: item.rating,
            voteAverage: Number(item.voteAverage) || 0,
            voteCount: Number(item.voteCount) || 0,
            year: item.year || '',
            genre_ids: (item.genre_ids || []).map(Number),
            keywordIds: (item.keywordIds || []).map(Number),
            ageBand: item.ageBand === undefined ? null : item.ageBand,
            ageEstimated: Boolean(item.ageEstimated),
            ageSource: item.ageSource || '',
            platformKeys: item.platformKeys || []
        };
    }

    function getEntry(state, id) {
        return state.movies[String(Number(id))] || null;
    }

    function setSeen(state, item, seen, now = Date.now()) {
        const key = String(Number(item.id));
        const entry = state.movies[key] || { item: snapshotItem(item), seen: false, liked: false };
        entry.item = snapshotItem(item);
        if (seen) {
            if (!entry.seen) entry.seenAt = now;
            entry.seen = true;
        } else {
            // Un film "pas vu" ne peut pas être "aimé" : on retire tout l'historique
            delete state.movies[key];
            return null;
        }
        state.movies[key] = entry;
        return entry;
    }

    function setLiked(state, item, liked, now = Date.now()) {
        // Aimer un film implique de l'avoir vu
        const entry = setSeen(state, item, true, now);
        if (liked) {
            if (!entry.liked) entry.likedAt = now;
            entry.liked = true;
        } else {
            entry.liked = false;
            delete entry.likedAt;
        }
        return entry;
    }

    // Films vus ou aimés, du plus récent au plus ancien
    function listByStatus(state, status) {
        const dateField = status === 'liked' ? 'likedAt' : 'seenAt';
        return Object.values(state.movies)
            .filter(entry => entry[status])
            .sort((a, b) => (b[dateField] || 0) - (a[dateField] || 0))
            .map(entry => entry.item);
    }

    // ---------------------------------------------------------------------------------------------
    // 3. Recommandations basées sur les films aimés
    // ---------------------------------------------------------------------------------------------

    const SCORE_WEIGHTS = { tmdb: 0.35, genres: 0.25, keywords: 0.25, quality: 0.15 };

    // Profil de goût : poids de chaque genre / mot-clé = part des films aimés qui le contiennent
    function buildTasteProfile(likedItems) {
        const genres = new Map();
        const keywords = new Map();
        const count = likedItems.length;
        for (const item of likedItems) {
            for (const g of new Set(item.genre_ids || [])) genres.set(g, (genres.get(g) || 0) + 1);
            for (const k of new Set(item.keywordIds || [])) keywords.set(k, (keywords.get(k) || 0) + 1);
        }
        for (const map of [genres, keywords]) {
            for (const [key, value] of map) map.set(key, value / count);
        }
        return { genres, keywords, count };
    }

    // Similarité cosinus entre le profil (vecteur pondéré) et un film (vecteur binaire), entre 0 et 1
    function cosineSimilarity(weights, ids) {
        const unique = [...new Set(ids || [])];
        if (!unique.length || !weights.size) return 0;
        let dot = 0;
        for (const id of unique) dot += weights.get(id) || 0;
        if (!dot) return 0;
        let norm = 0;
        for (const w of weights.values()) norm += w * w;
        return dot / (Math.sqrt(norm) * Math.sqrt(unique.length));
    }

    // Note TMDB "bayésienne" : une note de 9/10 sur 3 votes ne doit pas battre 8/10 sur 10 000 votes
    function qualityScore(voteAverage, voteCount, priorVotes = 150, priorMean = 6.5) {
        const avg = Number(voteAverage) || 0;
        const votes = Number(voteCount) || 0;
        const weighted = (votes / (votes + priorVotes)) * avg + (priorVotes / (votes + priorVotes)) * priorMean;
        return Math.min(1, Math.max(0, (weighted - 5) / 4));
    }

    // seedHits : ids des films aimés pour lesquels TMDB recommande ce candidat
    function scoreCandidate(candidate, profile, seedHits, seedCount) {
        const hits = seedHits ? seedHits.length : 0;
        const parts = {
            tmdb: seedCount ? Math.min(1, hits / Math.min(3, seedCount)) : 0,
            genres: cosineSimilarity(profile.genres, candidate.genre_ids),
            keywords: cosineSimilarity(profile.keywords, candidate.keywordIds),
            quality: qualityScore(candidate.voteAverage, candidate.voteCount)
        };
        const score = Object.keys(SCORE_WEIGHTS).reduce((sum, key) => sum + SCORE_WEIGHTS[key] * parts[key], 0);
        return { score, parts };
    }

    // Film aimé qui "explique" le mieux une recommandation
    function pickReason(candidate, likedItems, seedHits) {
        if (seedHits && seedHits.length) {
            const seed = likedItems.find(l => l.id === seedHits[0]);
            if (seed) return seed;
        }
        let best = null;
        let bestOverlap = 0;
        for (const liked of likedItems) {
            const genres = (liked.genre_ids || []).filter(g => (candidate.genre_ids || []).includes(g)).length;
            const keywords = (liked.keywordIds || []).filter(k => (candidate.keywordIds || []).includes(k)).length;
            const overlap = genres + 2 * keywords;
            if (overlap > bestOverlap) {
                best = liked;
                bestOverlap = overlap;
            }
        }
        return best;
    }

    /**
     * Classe les candidats selon leur affinité avec les films aimés.
     * @param {object} options
     * @param {object[]} options.candidates   films classés (ageBand, genre_ids, keywordIds, voteAverage, voteCount)
     * @param {object[]} options.likedItems   films aimés (snapshots de l'historique)
     * @param {Set<number>} options.seenIds   films déjà vus, toujours exclus
     * @param {Map<number, number[]>} options.recoSources  candidat -> films aimés qui le recommandent sur TMDB
     * @param {number} options.maxAge         tranche d'âge maximale (3, 6, 9 ou 12)
     * @param {number} [options.limit]
     */
    function recommend({ candidates, likedItems, seenIds, recoSources, maxAge, limit = 40 }) {
        if (!likedItems.length) return [];
        const profile = buildTasteProfile(likedItems);
        const likedIds = new Set(likedItems.map(l => l.id));
        const unique = new Map();
        for (const c of candidates) if (!unique.has(c.id)) unique.set(c.id, c);

        const ranked = [];
        for (const candidate of unique.values()) {
            if (seenIds.has(candidate.id) || likedIds.has(candidate.id)) continue;
            if (candidate.ageBand === null || candidate.ageBand === undefined || candidate.ageBand > maxAge) continue;
            const hits = ((recoSources && recoSources.get(candidate.id)) || []).filter(id => likedIds.has(id));
            const { score, parts } = scoreCandidate(candidate, profile, hits, likedItems.length);
            // Sans aucun lien avec les goûts (seule la note compte), ce n'est pas une recommandation
            if (!parts.tmdb && !parts.genres && !parts.keywords) continue;
            const reason = pickReason(candidate, likedItems, hits);
            ranked.push({ ...candidate, recoScore: score, recoParts: parts, reasonId: reason ? reason.id : null, reasonTitle: reason ? reason.title : '' });
        }
        ranked.sort((a, b) => b.recoScore - a.recoScore || (b.voteCount || 0) - (a.voteCount || 0));
        return ranked.slice(0, limit);
    }

    const api = {
        AGE_BANDS, MAX_KIDS_AGE, STORAGE_KEY, VIEWS, SCORE_WEIGHTS, NOT_FOR_KIDS_GENRES, GENRE_ANIMATION, GENRE_FAMILY,
        certificationToAge, ageToBand, pickCertification, classifyAge,
        defaultState, loadState, saveState, snapshotItem, getEntry, setSeen, setLiked, listByStatus,
        buildTasteProfile, cosineSimilarity, qualityScore, scoreCandidate, pickReason, recommend
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.SolarfinKids = api;
})(typeof window !== 'undefined' ? window : globalThis);

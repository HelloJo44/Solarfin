// Tests de la logique de l'onglet Enfants. Lancer avec : node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const Kids = require('../kids.js');

const cert = (country, certification, type = 3) => ({ iso_3166_1: country, release_dates: [{ certification, type }] });

function memoryStorage() {
    const data = new Map();
    return { getItem: k => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)) };
}

test('ageToBand arrondit à la tranche supérieure et exclut au-delà de 12 ans', () => {
    assert.equal(Kids.ageToBand(0), 3);
    assert.equal(Kids.ageToBand(4), 6);
    assert.equal(Kids.ageToBand(8), 9);
    assert.equal(Kids.ageToBand(10), 12);
    assert.equal(Kids.ageToBand(12), 12);
    assert.equal(Kids.ageToBand(13), null);
});

test('classifyAge utilise les Pays-Bas en priorité', () => {
    const result = Kids.classifyAge([cert('US', 'PG'), cert('NL', '6'), cert('FR', 'U')], [16]);
    assert.deepEqual(result, { band: 6, source: 'NL 6', estimated: false });
});

test('classifyAge passe au pays suivant si la certification est vide ou inconnue', () => {
    const result = Kids.classifyAge([cert('NL', ''), cert('DE', 'NR'), cert('GB', 'PG')], []);
    assert.equal(result.band, 9);
    assert.equal(result.source, 'GB PG');
});

test('classifyAge : "Tous publics" français reste prudent (6+), PG-13 et R sont exclus', () => {
    assert.equal(Kids.classifyAge([cert('FR', 'U')], []).band, 6);
    assert.equal(Kids.classifyAge([cert('FR', '10')], []).band, 12);
    assert.equal(Kids.classifyAge([cert('US', 'PG-13')], []).band, null);
    assert.equal(Kids.classifyAge([cert('US', 'R')], [16]).band, null);
});

test('classifyAge préfère la sortie cinéma aux autres types de sortie', () => {
    const nl = { iso_3166_1: 'NL', release_dates: [{ certification: '12', type: 5 }, { certification: '9', type: 3 }] };
    assert.equal(Kids.classifyAge([nl], []).band, 9);
});

test('classifyAge estime 6+ pour un film familial sans certification, sauf genre à risque', () => {
    assert.deepEqual(Kids.classifyAge([], [16, 10751]), { band: 6, source: 'estimé (genres)', estimated: true });
    assert.equal(Kids.classifyAge([], [16, 27]).band, null); // animation + horreur
    assert.equal(Kids.classifyAge(undefined, [18]).band, null); // drame sans certification
});

test('aimer un film le marque comme vu ; le retirer des vus retire aussi le "aimé"', () => {
    const state = Kids.defaultState();
    const film = { id: 862, title: 'Toy Story', genre_ids: [16] };
    Kids.setLiked(state, film, true, 100);
    assert.equal(Kids.getEntry(state, 862).seen, true);
    assert.equal(Kids.getEntry(state, 862).liked, true);
    Kids.setSeen(state, film, false, 200);
    assert.equal(Kids.getEntry(state, 862), null);
});

test('listByStatus trie du plus récent au plus ancien', () => {
    const state = Kids.defaultState();
    Kids.setSeen(state, { id: 1, title: 'A' }, true, 100);
    Kids.setSeen(state, { id: 2, title: 'B' }, true, 300);
    Kids.setLiked(state, { id: 3, title: 'C' }, true, 200);
    assert.deepEqual(Kids.listByStatus(state, 'seen').map(i => i.id), [2, 3, 1]);
    assert.deepEqual(Kids.listByStatus(state, 'liked').map(i => i.id), [3]);
});

test("l'état est sauvegardé et relu, et un stockage corrompu ne casse rien", () => {
    const storage = memoryStorage();
    const state = Kids.defaultState();
    state.maxAge = 6;
    state.view = 'reco';
    Kids.setLiked(state, { id: 10, title: 'Coco', genre_ids: [16, 10751] }, true, 1);
    Kids.saveState(storage, state);
    const loaded = Kids.loadState(storage);
    assert.equal(loaded.maxAge, 6);
    assert.equal(loaded.view, 'reco');
    assert.equal(Kids.getEntry(loaded, 10).liked, true);

    storage.setItem(Kids.STORAGE_KEY, '{pas du json');
    assert.deepEqual(Kids.loadState(storage), Kids.defaultState());
    storage.setItem(Kids.STORAGE_KEY, JSON.stringify({ version: 1, maxAge: 99, view: 'hack' }));
    assert.equal(Kids.loadState(storage).maxAge, 12);
    assert.equal(Kids.loadState(storage).view, 'catalogue');
});

test('cosineSimilarity vaut 1 pour un profil identique et 0 sans point commun', () => {
    const profile = Kids.buildTasteProfile([{ genre_ids: [16, 10751] }]);
    assert.ok(Math.abs(Kids.cosineSimilarity(profile.genres, [16, 10751]) - 1) < 1e-9);
    assert.equal(Kids.cosineSimilarity(profile.genres, [99]), 0);
    assert.equal(Kids.cosineSimilarity(profile.genres, []), 0);
});

test('qualityScore ne laisse pas une note sur très peu de votes dominer', () => {
    assert.ok(Kids.qualityScore(8, 10000) > Kids.qualityScore(10, 3));
});

const liked = [
    { id: 1, title: 'Le Roi Lion', genre_ids: [16, 10751, 12], keywordIds: [100, 101] },
    { id: 2, title: 'Vaiana', genre_ids: [16, 10751, 12], keywordIds: [102] }
];
const candidate = (id, extra) => ({ id, title: `Film ${id}`, ageBand: 6, genre_ids: [], keywordIds: [], voteAverage: 7, voteCount: 1000, ...extra });

test('recommend classe en premier le film le plus proche des goûts', () => {
    const results = Kids.recommend({
        candidates: [
            candidate(10, { genre_ids: [35] }),
            candidate(11, { genre_ids: [16, 10751, 12], keywordIds: [100] }),
            candidate(12, { genre_ids: [16] })
        ],
        likedItems: liked, seenIds: new Set(), recoSources: new Map(), maxAge: 12
    });
    assert.deepEqual(results.map(r => r.id), [11, 12]); // 10 n'a aucun lien avec les goûts
    assert.equal(results[0].reasonTitle, 'Le Roi Lion');
});

test('recommend exclut les films déjà vus et ceux au-dessus de la tranche choisie', () => {
    const results = Kids.recommend({
        candidates: [
            candidate(20, { genre_ids: [16], ageBand: 12 }),
            candidate(21, { genre_ids: [16], ageBand: 3 }),
            candidate(22, { genre_ids: [16], ageBand: 3 }),
            candidate(23, { genre_ids: [16], ageBand: null })
        ],
        likedItems: liked, seenIds: new Set([22]), recoSources: new Map(), maxAge: 6
    });
    assert.deepEqual(results.map(r => r.id), [21]);
});

test('recommend valorise les recommandations TMDB et les explique par le film aimé source', () => {
    const results = Kids.recommend({
        candidates: [candidate(30, { genre_ids: [16] }), candidate(31, { genre_ids: [16] })],
        likedItems: liked, seenIds: new Set(), recoSources: new Map([[31, [2]]]), maxAge: 12
    });
    assert.equal(results[0].id, 31);
    assert.equal(results[0].reasonTitle, 'Vaiana');
});

test('recommend renvoie une liste vide sans film aimé', () => {
    assert.deepEqual(Kids.recommend({ candidates: [candidate(1)], likedItems: [], seenIds: new Set(), recoSources: new Map(), maxAge: 12 }), []);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTmdb } from '../server/providers/tmdb.js';
import { createOpenLibrary } from '../server/providers/openlibrary.js';
import { createMusicBrainz } from '../server/providers/musicbrainz.js';
import { searchExternal } from '../server/providers/index.js';
import { normalizeGenre } from '../server/taxonomy.js';

const fakeFetch = (routes) => async (url) => {
  const u = String(url);
  const hit = Object.entries(routes).find(([k]) => u.includes(k));
  if (!hit) return { ok: false, status: 404, json: async () => ({}) };
  return { ok: true, status: 200, json: async () => hit[1] };
};

test('normalizeGenre maps provider names onto the shared vocabulary', () => {
  assert.equal(normalizeGenre('Science Fiction'), 'sci-fi');
  assert.equal(normalizeGenre('Deep House'), 'house');
  assert.equal(normalizeGenre('Indie Folk'), 'folk');
  assert.equal(normalizeGenre('Horror tales'), 'horror');
  assert.equal(normalizeGenre('Accordion polka'), null);
});

test('TMDB is disabled without a key', () => {
  assert.equal(createTmdb({ apiKey: '' }), null);
});

test('TMDB search maps results and flags future dates as upcoming', async () => {
  const tmdb = createTmdb({
    apiKey: 'k',
    fetchImpl: fakeFetch({
      '/search/movie': {
        results: [
          { id: 1, title: 'Old Film', release_date: '1999-01-01', genre_ids: [27, 53], overview: 'x', poster_path: '/p.jpg' },
          { id: 2, title: 'Future Film', release_date: '2999-01-01', genre_ids: [878] },
        ],
      },
    }),
  });
  const r = await tmdb.search('film', 'movie');
  assert.equal(r.length, 2);
  assert.deepEqual(r[0].genres, ['horror', 'thriller']);
  assert.ok(r[0].moods.includes('dark'));
  assert.equal(r[0].status, 'released');
  assert.equal(r[0].external_id, 'movie:1');
  assert.match(r[0].image_url, /^https:\/\/image\.tmdb\.org/);
  assert.equal(r[1].status, 'upcoming');
});

test('Open Library maps docs to books', async () => {
  const ol = createOpenLibrary({
    fetchImpl: fakeFetch({
      'search.json': { docs: [{ key: '/works/OL1W', title: 'Dune', author_name: ['Frank Herbert'], first_publish_year: 1965, subject: ['Science fiction', 'Deserts'], cover_i: 42 }] },
    }),
  });
  const [b] = await ol.search('dune');
  assert.equal(b.medium, 'book');
  assert.deepEqual(b.creators, ['Frank Herbert']);
  assert.deepEqual(b.genres, ['sci-fi']);
  assert.equal(b.external_id, '/works/OL1W');
});

test('MusicBrainz keeps albums and EPs and maps tags to genres', async () => {
  const mb = createMusicBrainz({
    fetchImpl: fakeFetch({
      'release-group': {
        'release-groups': [
          { id: 'a', title: 'Homework', 'primary-type': 'Album', 'first-release-date': '1997-01-20', 'artist-credit': [{ name: 'Daft Punk' }], tags: [{ name: 'house', count: 5 }, { name: 'french', count: 1 }] },
          { id: 'b', title: 'Da Funk', 'primary-type': 'Single' },
        ],
      },
    }),
  });
  const r = await mb.search('homework');
  assert.equal(r.length, 1);
  assert.equal(r[0].title, 'Homework');
  assert.deepEqual(r[0].genres, ['house']);
  assert.equal(r[0].year, 1997);
});

test('searchExternal keeps going when one provider fails', async () => {
  const ok = { name: 'ok', media: ['book'], search: async () => [{ title: 'A' }] };
  const bad = { name: 'bad', media: ['book'], search: async () => { throw new Error('boom'); } };
  const { results, errors } = await searchExternal([ok, bad], 'q', 'book');
  assert.equal(results.length, 1);
  assert.deepEqual(errors, [{ provider: 'bad', error: 'boom' }]);
});

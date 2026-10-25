import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoTag, guessKind } from '../server/taxonomy.js';
import { cityFrom, csv, parseImport } from '../server/importers.js';
import { findPatterns, inWindow, rankSpots, tasteProfile } from '../server/taste-graph.js';

test('autoTag: keywords and music genres become shared tags', () => {
  assert.deepEqual(new Set(autoTag('Candlelit wine bar')), new Set(['moody', 'intimate', 'romantic', 'wine bar']));
  assert.ok(autoTag('Croissants', null).includes('pastry'));
  assert.ok(autoTag('late night jazz').includes('chill'));
  assert.ok(!autoTag('Passenger').includes('pastry'));
  assert.equal(guessKind(['pastry', 'food']), 'food');
  assert.equal(guessKind([], 'song'), 'song');
});

test('importers: Spotify library export, plain lines and the Web API shape', () => {
  const lib = parseImport('spotify', JSON.stringify({ tracks: [{ artist: 'Miles Davis', album: 'Kind of Blue', track: 'So What', uri: 'spotify:track:abc' }] }));
  assert.equal(lib[0].title, 'So What');
  assert.equal(lib[0].creator, 'Miles Davis');
  assert.equal(lib[0].url, 'https://open.spotify.com/track/abc');
  const lines = parseImport('spotify', 'Nick Drake - Pink Moon\n\nBill Evans – Blue in Green');
  assert.deepEqual(lines.map((r) => [r.creator, r.title]), [['Nick Drake', 'Pink Moon'], ['Bill Evans', 'Blue in Green']]);
  const web = parseImport('spotify', JSON.stringify({ items: [{ added_at: '2024-01-01', track: { name: 'Teardrop', artists: [{ name: 'Massive Attack' }], uri: 'spotify:track:x' } }] }));
  assert.equal(web[0].creator, 'Massive Attack');
});

test('importers: Instagram collections carry their names onto posts', () => {
  const json = {
    saved_saved_collections: [
      { title: 'Collection', string_map_data: { Name: { value: 'Pastry' } } },
      { title: 'laminationlab', string_map_data: { 'Added Time': { href: 'https://www.instagram.com/p/1', timestamp: 1700000000 } } },
      { title: 'Collection', string_map_data: { Name: { value: 'Coats' } } },
      { title: 'thecoat', string_map_data: { 'Added Time': { href: 'https://www.instagram.com/p/2', timestamp: 1700000000 } } },
    ],
  };
  const rows = parseImport('instagram', JSON.stringify(json));
  assert.deepEqual(rows.map((r) => [r.title, r.collection]), [['@laminationlab', 'Pastry'], ['@thecoat', 'Coats']]);
  assert.equal(rows[0].saved_at.slice(0, 4), '2023');
});

test('importers: Google Maps GeoJSON (old and new shapes) and CSV lists', () => {
  const geo = {
    type: 'FeatureCollection',
    features: [
      { properties: { location: { name: 'Jazz café', address: '12 Soi Ari, Bangkok 10400' }, google_maps_url: 'https://maps.google.com/?cid=1' } },
      { properties: { Title: 'Old pub', Location: { Address: 'Dublin 8, Ireland' } } },
    ],
  };
  const rows = parseImport('google_maps', JSON.stringify(geo), { cities: ['Bangkok', 'Dublin'] });
  assert.deepEqual(rows.map((r) => [r.title, r.city]), [['Jazz café', 'Bangkok'], ['Old pub', 'Dublin']]);
  const list = parseImport('google_maps', 'Title,Note,URL,Comment\n"Bakery, the good one",croissants,https://maps.google.com/?cid=2,\n');
  assert.equal(list[0].title, 'Bakery, the good one');
  assert.equal(list[0].note, 'croissants');
  assert.equal(cityFrom('Londonderry', ['London']), null);
  assert.deepEqual(csv('a,b\n"x ""y""",z'), [{ a: 'x "y"', b: 'z' }]);
});

test('importers: empty, unknown and malformed input are 400s', () => {
  assert.throws(() => parseImport('spotify', '  '), (e) => e.status === 400);
  assert.throws(() => parseImport('myspace', 'x'), (e) => e.status === 400);
  assert.throws(() => parseImport('spotify', '{broken'), (e) => e.status === 400);
  assert.throws(() => parseImport('instagram', '{"nothing": []}'), (e) => e.status === 400);
});

const save = (id, kind, source, tags, extra = {}) => ({ id, kind, source, title: `s${id}`, tags, ...extra });

test('findPatterns: only combinations that cross kinds or apps', () => {
  const saves = [
    save(1, 'song', 'spotify', ['jazz', 'chill']),
    save(2, 'song', 'spotify', ['jazz', 'chill']),
    save(3, 'place', 'google_maps', ['jazz', 'intimate', 'chill']),
    save(4, 'food', 'instagram', ['pastry']),
    save(5, 'food', 'instagram', ['pastry']),
    save(6, 'food', 'instagram', ['pastry']),
  ];
  const p = findPatterns(saves);
  assert.equal(p.length, 1);
  assert.deepEqual(p[0].tags.slice(0, 2).sort(), ['chill', 'jazz']);
  assert.deepEqual(p[0].kinds, { song: 2, place: 1 });
});

test('tasteProfile: media moods count, at half weight', () => {
  const p = tasteProfile([save(1, 'song', 'spotify', ['jazz'])], new Map([['mood:dark', 2], ['genre:jazz', 1], ['creator:x', 5]]));
  assert.equal(p.get('jazz'), 1 + 0.25);
  assert.equal(p.get('dark'), 0.5);
  assert.ok(!p.has('x'));
});

test('rankSpots: city, dates, taste, friends and explanations', () => {
  const saves = [save(1, 'song', 'spotify', ['jazz', 'chill']), save(2, 'place', 'google_maps', ['jazz', 'intimate'])];
  const profile = tasteProfile(saves);
  const spots = [
    { id: 1, kind: 'event', title: 'Jazz night', city: 'Dublin', tags: ['jazz', 'intimate'], starts_at: '2026-11-14', popularity: 0.2 },
    { id: 2, kind: 'event', title: 'Jazz next year', city: 'Dublin', tags: ['jazz'], starts_at: '2027-05-01' },
    { id: 3, kind: 'event', title: 'Techno', city: 'Dublin', tags: ['techno'], starts_at: '2026-11-14' },
    { id: 4, kind: 'place', title: 'London jazz bar', city: 'London', tags: ['jazz'] },
    { id: 5, kind: 'product', title: 'Online vinyl', city: null, tags: ['jazz', 'vinyl'] },
    { id: 6, kind: 'place', title: 'Pub', city: 'Dublin', tags: ['pub'] },
    { id: 7, kind: 'place', title: 'New café', city: 'Dublin', tags: ['chill'], opened_at: '2026-11-01' },
  ];
  const r = rankSpots({ profile, saves, spots, city: 'dublin', from: '2026-11-10', to: '2026-11-20', friendSaves: new Map([[6, ['Maya']]]), today: '2026-11-10' });
  const ids = r.map((x) => x.spot.id);
  assert.deepEqual(ids.sort(), [1, 5, 6, 7]);
  const jazz = r.find((x) => x.spot.id === 1);
  const ev = jazz.reasons.find((x) => x.type === 'saves').evidence.find((e) => e.tag === 'jazz');
  assert.deepEqual(ev.sources.map((s) => [s.source, s.n]), [['spotify', 1], ['google_maps', 1]]);
  assert.ok(jazz.reasons.some((x) => x.type === 'gem'));
  assert.ok(r.find((x) => x.spot.id === 6).reasons.some((x) => x.type === 'friends'));
  assert.ok(r.find((x) => x.spot.id === 7).reasons.some((x) => x.type === 'new'));
  assert.equal(rankSpots({ profile, spots, exclude: new Set([1, 2, 4, 5, 7]) }).length, 0);
});

test('inWindow: multi-day events overlap the range', () => {
  const ev = { kind: 'event', starts_at: '2026-11-01', ends_at: '2026-11-30' };
  assert.ok(inWindow(ev, '2026-11-10', '2026-11-12'));
  assert.ok(!inWindow(ev, '2026-12-01', '2026-12-02'));
  assert.ok(inWindow({ kind: 'place' }, '2030-01-01', '2030-01-02'));
});

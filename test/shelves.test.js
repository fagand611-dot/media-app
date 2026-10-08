import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildProfile, recommend } from '../server/recommender.js';
import { buildHome } from '../server/shelves.js';

let nextId = 1;
const item = (medium, title, genres, moods, year = 2000, creators = []) => ({ id: nextId++, medium, title, genres, moods, year, creators, status: 'released' });

const loved = item('tv', 'Twin Peaks', ['mystery', 'drama'], ['weird', 'dark', 'atmospheric'], 1990, ['David Lynch']);
const catalogue = [
  item('movie', 'Mulholland Drive', ['mystery', 'drama'], ['weird', 'dark'], 2001, ['David Lynch']),
  item('movie', 'Blue Velvet', ['mystery', 'crime'], ['weird', 'dark'], 1986, ['David Lynch']),
  item('tv', 'True Detective', ['crime', 'mystery'], ['dark', 'atmospheric'], 2014),
  item('book', 'House of Leaves', ['horror'], ['weird', 'dark'], 2000),
  item('book', 'Piranesi', ['fantasy'], ['weird', 'atmospheric'], 2020),
  item('music', 'Untrue', ['electronic'], ['dark', 'atmospheric'], 2007),
  item('music', 'Selected Ambient Works', ['ambient'], ['atmospheric', 'weird'], 1992),
  item('movie', 'Alien', ['horror', 'sci-fi'], ['dark', 'tense'], 1979),
  item('movie', 'The Thing', ['horror'], ['dark', 'tense', 'atmospheric'], 1982),
  item('movie', 'Paddington 2', ['comedy'], ['uplifting', 'funny'], 2017),
  item('music', 'Happy Pop', ['pop'], ['uplifting'], 2024),
];
const library = [{ item: loved, state: 'done', score: 10, updated_at: '2026-01-01 00:00:00' }];
const profile = buildProfile(library);
const scored = recommend({ profile, library, candidates: catalogue, limit: catalogue.length, diversify: false });
const byTitle = (t) => catalogue.find((i) => i.title === t);

const home = (extra = {}) => buildHome({ profile, library, scored, hasFriends: true, userId: 1, now: new Date('2026-10-08'), ...extra });
const shelf = (h, id) => h.shelves.find((s) => s.id === id);

test('hero is the top-scored item, with reasons', () => {
  const h = home();
  assert.equal(h.hero.item.id, scored[0].item.id);
  assert.ok(h.hero.reasons.length);
});

test('no item appears twice anywhere on the page', () => {
  const h = home({
    circle: [{ item: byTitle('Alien'), friend: { name: 'Maya', username: 'maya' }, score: 9, at: '2026-10-07 10:00:00' }],
    upcoming: [],
  });
  const ids = [h.hero.item.id, ...h.shelves.flatMap((s) => (s.items || []).map((e) => e.item.id))];
  assert.equal(new Set(ids).size, ids.length);
});

test('"New in your circle" groups friends per item, newest first', () => {
  const at = (d) => `2026-10-0${d} 12:00:00`;
  const h = home({
    circle: [
      { item: byTitle('Alien'), friend: { name: 'Maya', username: 'maya' }, score: 9, review: 'Perfect.', at: at(7) },
      { item: byTitle('Paddington 2'), friend: { name: 'Jo', username: 'jo' }, score: 8, at: at(5) },
      { item: byTitle('Alien'), friend: { name: 'Sam', username: 'sam' }, score: 7, at: at(3) },
    ],
  });
  const circle = shelf(h, 'circle');
  assert.equal(circle.kind, 'circle');
  assert.deepEqual(circle.items.map((e) => e.item.title), ['Alien', 'Paddington 2']);
  assert.deepEqual(circle.items[0].by.map((b) => b.name), ['Maya', 'Sam']);
});

test('without friends, the circle shelf becomes a call to action', () => {
  const circle = shelf(home({ hasFriends: false }), 'circle');
  assert.equal(circle.kind, 'cta');
  assert.equal(circle.action.to, '/friends');
});

test('"Because you loved" is anchored on a favourite and favours the same creator', () => {
  const because = shelf(home(), 'because');
  assert.equal(because.anchor.title, 'Twin Peaks');
  const lynch = because.items.find((e) => e.item.title === 'Blue Velvet' || e.item.title === 'Mulholland Drive');
  assert.ok(lynch, 'a David Lynch film should be in the row (unless it was the hero)');
});

test('crossover shelf only has other media and bridges on mood', () => {
  const cross = shelf(home(), 'crossover');
  assert.ok(cross, 'crossover shelf exists');
  assert.match(cross.title, /beyond the screen/);
  assert.ok(cross.items.every((e) => e.item.medium === 'book' || e.item.medium === 'music'));
  assert.ok(cross.items.every((e) => e.item.moods.some((m) => loved.moods.includes(m))));
});

test('shelves with too few items are dropped, and mood titles read naturally', () => {
  const h = home();
  for (const s of h.shelves) if (s.kind === 'items' && s.id !== 'soon') assert.ok(s.items.length >= 3, `${s.id} has ${s.items.length}`);
  const mood = shelf(h, 'mood');
  if (mood) assert.match(mood.title, /^In (a [^aeiou]|an [aeiou])/);
});

test('coming soon uses upcoming items and keeps the watch state', () => {
  const soon = item('movie', 'Lynch Returns', ['mystery'], ['weird', 'dark'], 2027);
  soon.status = 'in_production';
  const h = home({ upcoming: [{ item: soon, match: 80, watching: true }, { item: { ...soon, id: 999 }, match: 70, watching: false }] });
  const s = shelf(h, 'soon');
  assert.equal(s.items[0].item.title, 'Lynch Returns');
  assert.equal(s.items[0].watching, true);
});

test('friend lists shelf only shows lists with something new for you', () => {
  const lists = [
    { id: 1, title: 'All seen', unseen: 0, count: 3, updated_at: '2026-10-01', covers: [] },
    { id: 2, title: 'Fresh', unseen: 2, count: 3, updated_at: '2026-10-02', covers: [] },
  ];
  const s = shelf(home({ friendLists: lists }), 'lists');
  assert.deepEqual(s.lists.map((l) => l.title), ['Fresh']);
});

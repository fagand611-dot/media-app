import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildProfile, cosine, itemFeatures, normScore, qualityPrior, recommend, tasteSimilarity, toPercent, topTags } from '../server/recommender.js';

let nextId = 1;
const item = (medium, title, genres, moods, creators = [], year = 2000) => ({ id: nextId++, medium, title, genres, moods, creators, year });

const thing = item('movie', 'The Thing', ['horror', 'sci-fi'], ['dark', 'tense'], ['John Carpenter'], 1982);
const halloween = item('movie', 'Halloween', ['horror'], ['dark', 'tense'], ['John Carpenter'], 1978);
const paddington = item('movie', 'Paddington 2', ['comedy'], ['uplifting', 'funny'], ['Paul King'], 2017);
const hillHouseBook = item('book', 'Hill House', ['horror'], ['dark', 'atmospheric'], ['Shirley Jackson'], 1959);
const happyPop = item('music', 'Happy Pop', ['pop'], ['uplifting'], ['Someone'], 2020);
const darkAmbient = item('music', 'Dark Ambient', ['ambient'], ['dark', 'atmospheric'], ['Somebody'], 2020);

test('normScore maps 1..10 to -1..+1 around 5.5', () => {
  assert.equal(normScore(1), -1);
  assert.equal(normScore(10), 1);
  assert.equal(normScore(5.5), 0);
});

test('item features include genres, moods, creators (lowercased), era and medium', () => {
  const f = itemFeatures(thing);
  assert.ok(f.has('genre:horror'));
  assert.ok(f.has('mood:dark'));
  assert.ok(f.has('creator:john carpenter'));
  assert.ok(f.has('era:1980s'));
  assert.ok(f.has('medium:movie'));
});

test('cosine is 1 for identical vectors and 0 for disjoint ones', () => {
  const a = new Map([['x', 1], ['y', 2]]);
  assert.ok(Math.abs(cosine(a, a) - 1) < 1e-9);
  assert.equal(cosine(a, new Map([['z', 1]])), 0);
  assert.equal(cosine(a, new Map()), 0);
});

test('profile: high ratings push features up, low ratings push them down', () => {
  const p = buildProfile([
    { item: thing, state: 'done', score: 10 },
    { item: paddington, state: 'done', score: 2 },
  ]);
  assert.ok(p.get('mood:dark') > 0);
  assert.ok(p.get('mood:uplifting') < 0);
});

test('profile: want, dismissed and tag prefs all contribute', () => {
  const p = buildProfile(
    [
      { item: thing, state: 'want', score: null },
      { item: paddington, state: 'dismissed', score: null },
    ],
    [{ tag: 'mood:atmospheric', weight: 1 }]
  );
  assert.ok(p.get('genre:horror') > 0);
  assert.ok(p.get('genre:comedy') < 0);
  assert.equal(p.get('mood:atmospheric'), 1);
});

test('recommend: ranks matching items above clashing ones, across media', () => {
  const library = [{ item: thing, state: 'done', score: 10 }];
  const profile = buildProfile(library);
  const recs = recommend({ profile, library, candidates: [paddington, happyPop, halloween, hillHouseBook, darkAmbient], diversify: false });
  const order = recs.map((r) => r.item.title);
  assert.equal(order[0], 'Halloween'); // same director, genre and moods
  assert.ok(order.indexOf('Hill House') < order.indexOf('Paddington 2'), 'the horror novel beats the comedy');
  assert.ok(order.indexOf('Dark Ambient') < order.indexOf('Happy Pop'), 'mood tags bridge to music');
});

test('recommend: explains with "because you loved" and friend reasons', () => {
  const library = [{ item: thing, state: 'done', score: 9 }];
  const profile = buildProfile(library);
  const friendProfile = buildProfile([{ item: halloween, state: 'done', score: 9 }]);
  const recs = recommend({
    profile,
    library,
    candidates: [halloween],
    friends: [{ id: 99, name: 'Maya', profile: friendProfile }],
    friendScores: new Map([[halloween.id, [{ friendId: 99, score: 9 }]]]),
  });
  const reasons = recs[0].reasons;
  const because = reasons.find((r) => r.type === 'because');
  assert.equal(because.title, 'The Thing');
  assert.ok(because.tags.includes('John Carpenter'), 'creator label keeps its original capitalisation');
  assert.deepEqual(reasons.find((r) => r.type === 'friend'), { type: 'friend', name: 'Maya', score: 9 });
  assert.ok(recs[0].parts.social > 0);
});

test('recommend: a friend with similar taste counts for more than one without', () => {
  const library = [{ item: thing, state: 'done', score: 10 }];
  const profile = buildProfile(library);
  const twin = { id: 1, name: 'Twin', profile: buildProfile([{ item: halloween, state: 'done', score: 10 }]) };
  const opposite = { id: 2, name: 'Opposite', profile: buildProfile([{ item: paddington, state: 'done', score: 10 }]) };
  const base = { profile, library, candidates: [happyPop], diversify: false };
  const viaTwin = recommend({ ...base, friends: [twin], friendScores: new Map([[happyPop.id, [{ friendId: 1, score: 10 }]]]) });
  const viaOpp = recommend({ ...base, friends: [opposite], friendScores: new Map([[happyPop.id, [{ friendId: 2, score: 10 }]]]) });
  assert.ok(viaTwin[0].parts.social > viaOpp[0].parts.social);
});

test('recommend: diversity re-rank mixes media', () => {
  const library = [{ item: thing, state: 'done', score: 10 }];
  const profile = buildProfile(library);
  const films = Array.from({ length: 10 }, (_, i) => item('movie', `Slasher ${i}`, ['horror'], ['dark', 'tense'], ['John Carpenter'], 1980));
  const recs = recommend({ profile, library, candidates: [...films, hillHouseBook, darkAmbient], limit: 5 });
  const media = new Set(recs.map((r) => r.item.medium));
  assert.ok(media.size >= 2, `expected mixed media, got ${[...media]}`);
});

test('quality prior shrinks small samples toward the prior', () => {
  const one = qualityPrior([10]);
  const many = qualityPrior(Array(30).fill(10));
  assert.ok(many > one);
  assert.ok(one < 1 && one > qualityPrior([]));
});

test('tasteSimilarity and toPercent stay within 0..1 and 0..100', () => {
  const a = buildProfile([{ item: thing, state: 'done', score: 10 }]);
  const b = buildProfile([{ item: thing, state: 'done', score: 1 }]);
  assert.equal(tasteSimilarity(a, b), 0);
  assert.equal(toPercent(1.4), 100);
  assert.equal(toPercent(-1), 0);
});

test('topTags splits likes and dislikes and skips medium features', () => {
  const p = buildProfile([
    { item: thing, state: 'done', score: 10 },
    { item: paddington, state: 'done', score: 1 },
  ]);
  const { likes, dislikes } = topTags(p);
  assert.ok(likes.some((t) => t.tag === 'mood:dark'));
  assert.ok(dislikes.some((t) => t.tag === 'mood:uplifting'));
  assert.ok(![...likes, ...dislikes].some((t) => t.kind === 'medium'));
});

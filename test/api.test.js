import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { createApp } from '../server/app.js';
import { seedCatalog } from '../server/seed/seed.js';

let server;
let base;

before(async () => {
  const db = openDb(':memory:');
  seedCatalog(db);
  server = createApp({ db, providers: [] }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://localhost:${server.address().port}/api`;
});
after(() => server.close());

/** A tiny client that keeps its own session cookie. */
function client() {
  let cookie = '';
  const call = async (method, path, body) => {
    const res = await fetch(base + path, {
      method,
      headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return { status: res.status, body: await res.json() };
  };
  return {
    get: (p) => call('GET', p),
    post: (p, b = {}) => call('POST', p, b),
    put: (p, b = {}) => call('PUT', p, b),
    patch: (p, b = {}) => call('PATCH', p, b),
    del: (p) => call('DELETE', p),
  };
}

async function signup(username) {
  const c = client();
  const r = await c.post('/auth/register', { username, password: 'password123' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  c.id = r.body.user.id;
  return c;
}

async function befriend(a, b, bName) {
  await a.post('/friends/request', { username: bName });
  const r = await b.post(`/friends/${a.id}/accept`);
  assert.equal(r.status, 200);
}

test('auth: register, me, logout, login, bad password', async () => {
  const c = await signup('alice');
  assert.equal((await c.get('/me')).body.user.username, 'alice');
  await c.post('/auth/logout');
  assert.equal((await c.get('/me')).body.user, null);
  assert.equal((await c.get('/library')).status, 401);
  assert.equal((await c.post('/auth/login', { username: 'alice', password: 'nope-nope' })).status, 401);
  assert.equal((await c.post('/auth/login', { username: 'ALICE', password: 'password123' })).status, 200);
  assert.equal((await client().post('/auth/register', { username: 'alice', password: 'password123' })).status, 409);
  assert.equal((await client().post('/auth/register', { username: 'x', password: 'password123' })).status, 400);
});

test('onboarding + recommendations exclude what you have rated and reflect taste', async () => {
  const c = await signup('horrorfan');
  const { body } = await c.get('/onboarding/starters');
  const horror = body.starters.movie.find((i) => i.genres.includes('horror'));
  const comedy = body.starters.movie.find((i) => i.genres.includes('comedy') && !i.genres.includes('horror'));
  await c.post('/onboarding', {
    tags: ['genre:horror', 'mood:dark', 'not-a-tag'],
    ratings: [{ itemId: horror.id, score: 10 }, { itemId: comedy.id, score: 2 }],
  });
  assert.equal((await c.get('/me')).body.user.onboarded, true);

  const recs = (await c.get('/recommendations?limit=10')).body.recommendations;
  assert.equal(recs.length, 10);
  assert.ok(!recs.some((r) => r.item.id === horror.id || r.item.id === comedy.id));
  const top = recs.slice(0, 5).flatMap((r) => [...r.item.genres, ...r.item.moods]);
  assert.ok(top.includes('dark') || top.includes('horror'), `top picks should lean dark: ${top}`);
  assert.ok(recs.every((r) => r.item.status === 'released'));

  const books = (await c.get('/recommendations?medium=book')).body.recommendations;
  assert.ok(books.length && books.every((r) => r.item.medium === 'book'));
});

test('library: rate, review, want, dismiss, validation', async () => {
  const c = await signup('rater');
  const id = 1;
  let r = await c.put(`/library/${id}`, { score: 8, review: 'Great.' });
  assert.equal(r.body.entry.state, 'done');
  assert.equal(r.body.entry.score, 8);
  r = await c.put(`/library/${id}`, { state: 'dismissed' });
  assert.equal(r.body.entry.score, null, 'dismissing clears the score');
  assert.equal((await c.put(`/library/${id}`, { score: 11 })).status, 400);
  assert.equal((await c.put('/library/99999', { state: 'want' })).status, 404);
  assert.equal((await c.put('/library/abc', { state: 'want' })).status, 400);
  await c.put('/library/2', { state: 'want' });
  assert.equal((await c.get('/library?state=want')).body.entries.length, 1);
  await c.del('/library/2');
  assert.equal((await c.get('/library?state=want')).body.entries.length, 0);
});

test('privacy: library and friends-only lists are hidden from non-friends', async () => {
  const owner = await signup('owner1');
  const stranger = await signup('stranger1');
  await owner.put('/library/3', { score: 9, review: 'secret thoughts' });
  const list = (await owner.post('/lists', { title: 'Friends only', visibility: 'friends' })).body.list;
  const priv = (await owner.post('/lists', { title: 'Mine only', visibility: 'private' })).body.list;
  await owner.post(`/lists/${list.id}/items`, { itemId: 3 });

  let profile = (await stranger.get('/users/owner1')).body;
  assert.equal(profile.recent, undefined);
  assert.equal(profile.lists.length, 0);
  assert.equal((await stranger.get(`/lists/${list.id}`)).status, 404);
  assert.equal((await stranger.get('/items/3')).body.friends.length, 0);
  assert.equal((await stranger.post(`/lists/${list.id}/items`, { itemId: 4 })).status, 404, "can't edit someone else's list");

  await befriend(stranger, owner, 'owner1');
  profile = (await stranger.get('/users/owner1')).body;
  assert.equal(profile.relationship, 'friend');
  assert.equal(profile.recent[0].review, 'secret thoughts');
  assert.deepEqual(profile.lists.map((l) => l.title), ['Friends only']);
  assert.equal((await stranger.get(`/lists/${list.id}`)).status, 200);
  assert.equal((await stranger.get(`/lists/${priv.id}`)).status, 404);
  assert.equal((await stranger.get('/items/3')).body.friends[0].score, 9);
});

test('friends: request, mutual auto-accept, feed, unfriend', async () => {
  const a = await signup('fan_a');
  const b = await signup('fan_b');
  assert.equal((await a.post('/friends/request', { username: 'fan_b' })).body.status, 'pending');
  assert.equal((await b.get('/friends')).body.incoming[0].username, 'fan_a');
  // b asking a back accepts the pending request
  assert.equal((await b.post('/friends/request', { username: 'fan_a' })).body.status, 'accepted');
  assert.equal((await a.get('/friends')).body.friends[0].username, 'fan_b');
  assert.equal((await a.post('/friends/request', { username: 'fan_a' })).status, 400);

  await b.put('/library/5', { score: 9, review: 'Loved it' });
  const feed = (await a.get('/feed')).body.events;
  assert.equal(feed[0].user.username, 'fan_b');
  assert.equal(feed[0].item.id, 5);

  // A friend's high score shows up as a reason on a's recommendations
  const recs = (await a.get('/recommendations?limit=60')).body.recommendations;
  const rec = recs.find((r) => r.item.id === 5);
  assert.ok(rec?.reasons.some((x) => x.type === 'friend' && x.score === 9));

  await a.del(`/friends/${b.id}`);
  assert.equal((await a.get('/friends')).body.friends.length, 0);
  assert.equal((await a.get('/feed')).body.events.length, 0);
});

test('lists: create, add with note, edit, remove, delete', async () => {
  const c = await signup('lister');
  assert.equal((await c.post('/lists', { title: '' })).status, 400);
  const { list } = (await c.post('/lists', { title: 'Rainy day', visibility: 'public' })).body;
  await c.post(`/lists/${list.id}/items`, { itemId: 1, note: 'start here' });
  await c.post(`/lists/${list.id}/items`, { itemId: 2 });
  let detail = (await c.get(`/lists/${list.id}`)).body;
  assert.deepEqual(detail.items.map((i) => i.item.id), [1, 2]);
  assert.equal(detail.items[0].note, 'start here');
  await c.patch(`/lists/${list.id}`, { title: 'Rainy days', visibility: 'private' });
  await c.del(`/lists/${list.id}/items/1`);
  detail = (await c.get(`/lists/${list.id}`)).body;
  assert.equal(detail.list.title, 'Rainy days');
  assert.equal(detail.items.length, 1);
  await c.del(`/lists/${list.id}`);
  assert.equal((await c.get(`/lists/${list.id}`)).status, 404);
});

test('radar lists only unreleased items, and watching floats them up', async () => {
  const c = await signup('radar');
  let radar = (await c.get('/radar')).body.radar;
  assert.ok(radar.length > 0);
  assert.ok(radar.every((r) => r.item.status !== 'released'));
  const last = radar.at(-1).item.id;
  await c.put(`/library/${last}`, { state: 'want' });
  radar = (await c.get('/radar')).body.radar;
  assert.equal(radar[0].item.id, last);
  assert.equal(radar[0].watching, true);
});

test('items: manual add, search, taste tags', async () => {
  const c = await signup('adder');
  const bad = await c.post('/items', { medium: 'podcast', title: 'x' });
  assert.equal(bad.status, 400);
  const { item } = (await c.post('/items', { medium: 'music', title: 'Local Band LP', creators: ['Local Band'], genres: ['Indie Folk'], image_url: 'javascript:alert(1)' })).body;
  assert.deepEqual(item.genres, ['folk']);
  assert.ok(item.moods.length > 0, 'moods are derived from genres');
  assert.equal(item.image_url, null, 'only https image URLs are kept');
  assert.equal(item.source, 'user');
  const found = (await c.get('/search?q=local band')).body.local;
  assert.equal(found[0].id, item.id);

  assert.equal((await c.put('/taste/tags', { tag: 'mood:dark', weight: 2 })).status, 200);
  assert.equal((await c.put('/taste/tags', { tag: 'evil', weight: 2 })).status, 400);
  const taste = (await c.get('/taste')).body;
  assert.equal(taste.likes[0].tag, 'mood:dark');
});

// Seed the catalogue and, optionally, demo users.
//   npm run seed            → catalogue only (skipped if items already exist)
//   npm run seed -- --demo  → also adds demo friends (maya, sam, jo) and a `demo` account
import { fileURLToPath } from 'node:url';
import { openDb, tx, upsertItem } from '../db.js';
import { hashPassword } from '../auth.js';
import { BOOKS, DEMO_UPCOMING, MOVIES, MUSIC, TV } from './catalog.js';

export function seedCatalog(db) {
  let n = 0;
  tx(db, () => {
    const add = (medium, rows) => {
      for (const [title, year, creators, genres, moods, description] of rows) {
        upsertItem(db, { medium, title, year, creators, genres, moods, description, source: 'seed', external_id: `${medium}:${title}` });
        n++;
      }
    };
    add('movie', MOVIES);
    add('tv', TV);
    add('book', BOOKS);
    add('music', MUSIC);
    const now = new Date();
    DEMO_UPCOMING.forEach(([medium, title, genres, moods, status, description], i) => {
      const d = new Date(now.getTime() + (30 + i * 41) * 864e5).toISOString().slice(0, 10);
      upsertItem(db, {
        medium, title, genres, moods, description, status,
        year: status === 'announced' ? null : Number(d.slice(0, 4)),
        release_date: status === 'announced' ? null : d,
        source: 'seed', external_id: `demo:${title}`, is_demo: true,
      });
      n++;
    });
  });
  return n;
}

// Demo personas: tags they love and hate. Scores come from tag overlap plus
// some deterministic noise, so their tastes clearly differ but overlap a bit.
const PERSONAS = [
  { username: 'maya', name: 'Maya', loves: ['horror', 'folk', 'literary fiction', 'dark', 'atmospheric', 'emotional', 'mystery'], hates: ['high-energy', 'action'] },
  { username: 'sam', name: 'Sam', loves: ['action', 'sci-fi', 'house', 'techno', 'electronic', 'high-energy', 'epic', 'tense'], hates: ['romantic', 'chill'] },
  { username: 'jo', name: 'Jo', loves: ['comedy', 'rock', 'crime', 'indie', 'funny', 'gritty', 'humour'], hates: ['horror', 'ambient'] },
  // The demo account: wide taste, and fewer ratings so there's plenty left to recommend.
  { username: 'demo', name: 'Demo User', loves: ['drama', 'action', 'comedy', 'horror', 'house', 'rock', 'folk'], hates: ['metal', 'country'], coverage: 0.2 },
];

function hash(s) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 2 ** 32;
}

export function seedDemo(db, { password = 'demo1234' } = {}) {
  const items = db.prepare(`SELECT * FROM items WHERE status = 'released'`).all();
  const pw = hashPassword(password);
  tx(db, () => {
    const ids = {};
    for (const p of PERSONAS) {
      const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(p.username);
      ids[p.username] = existing
        ? existing.id
        : Number(db.prepare('INSERT INTO users (username, display_name, password_hash, onboarded) VALUES (?,?,?,1)').run(p.username, p.name, pw).lastInsertRowid);
    }
    const rate = db.prepare(
      `INSERT OR IGNORE INTO user_items (user_id, item_id, state, score, review, updated_at)
       VALUES (?,?,?,?,?, datetime('now', ?))`
    );
    for (const p of PERSONAS) {
      items.forEach((item, idx) => {
        const tags = [...JSON.parse(item.genres), ...JSON.parse(item.moods)];
        const love = tags.filter((t) => p.loves.includes(t)).length;
        const hate = tags.filter((t) => p.hates.includes(t)).length;
        const r = hash(p.username + item.id);
        const coverage = p.coverage ?? 0.75;
        if (love === 0 && r > coverage / 3) return; // mostly rate things they'd seek out
        if (r > coverage) return;
        const score = Math.max(1, Math.min(10, Math.round(5 + love * 1.6 - hate * 1.8 + (r / coverage - 0.5) * 3)));
        const review = score >= 9 && r < 0.3 ? `One of my all-time favourites. ${item.title} is exactly my thing.` : null;
        rate.run(ids[p.username], item.id, 'done', score, review, `-${idx * 7 + Math.floor(r * 300)} minutes`);
      });
    }
    const friend = db.prepare(`INSERT OR IGNORE INTO friendships (requester_id, addressee_id, status) VALUES (?,?, 'accepted')`);
    friend.run(ids.maya, ids.sam);
    friend.run(ids.maya, ids.jo);
    friend.run(ids.sam, ids.jo);
    for (const u of ['maya', 'sam', 'jo']) friend.run(ids[u], ids.demo);

    const mkList = (owner, title, description, titles) => {
      if (db.prepare('SELECT 1 FROM lists WHERE owner_id = ? AND title = ?').get(ids[owner], title)) return;
      const listId = db.prepare(`INSERT INTO lists (owner_id, title, description, visibility) VALUES (?,?,?, 'friends')`).run(ids[owner], title, description).lastInsertRowid;
      titles.forEach(([t, note], pos) => {
        const it = db.prepare('SELECT id FROM items WHERE title = ?').get(t);
        if (it) db.prepare('INSERT INTO list_items (list_id, item_id, note, position) VALUES (?,?,?,?)').run(listId, it.id, note || null, pos);
      });
    };
    mkList('maya', 'Rainy Sunday, lights off', 'Dark, slow and beautiful, across every medium.', [
      ['Twin Peaks', 'Start here.'], ['Pink Moon'], ['The Secret History', 'Read it in one weekend.'], ['Untrue'], ['Hereditary', 'Not for the faint-hearted.'],
    ]);
    mkList('sam', 'Gym & late-night drives', null, [['Homework'], ['Mad Max: Fury Road'], ['Immunity'], ['Neuromancer', 'Cyberpunk at its best.'], ['Settle']]);
    mkList('jo', 'Guaranteed laughs', 'For when the week has been long.', [['The Big Lebowski'], ['Arrested Development'], ['Good Omens'], ['What We Do in the Shadows'], ['Paddington 2', "Don't @ me, it's perfect."]]);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const db = openDb();
  if (!db.prepare('SELECT 1 FROM items LIMIT 1').get()) console.log(`Seeded ${seedCatalog(db)} catalogue items`);
  else console.log('Catalogue already present');
  if (process.argv.includes('--demo')) {
    seedDemo(db);
    console.log('Demo users added: maya, sam, jo, demo (password: demo1234)');
  }
}

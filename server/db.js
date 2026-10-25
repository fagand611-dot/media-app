import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const SCHEMA = `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  onboarded INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY,
  medium TEXT NOT NULL CHECK (medium IN ('movie','tv','book','music')),
  title TEXT NOT NULL,
  year INTEGER,
  creators TEXT NOT NULL DEFAULT '[]',
  genres TEXT NOT NULL DEFAULT '[]',
  moods TEXT NOT NULL DEFAULT '[]',
  description TEXT,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'released'
    CHECK (status IN ('released','upcoming','in_production','announced')),
  release_date TEXT,
  source TEXT NOT NULL DEFAULT 'local',
  external_id TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (source, external_id)
);
CREATE INDEX IF NOT EXISTS items_medium ON items(medium);
CREATE INDEX IF NOT EXISTS items_status ON items(status);

CREATE TABLE IF NOT EXISTS user_items (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  state TEXT NOT NULL CHECK (state IN ('want','in_progress','done','dismissed')),
  score INTEGER CHECK (score BETWEEN 1 AND 10),
  review TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, item_id)
);
CREATE INDEX IF NOT EXISTS user_items_item ON user_items(item_id);

CREATE TABLE IF NOT EXISTS tag_prefs (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  weight REAL NOT NULL,
  PRIMARY KEY (user_id, tag)
);

CREATE TABLE IF NOT EXISTS friendships (
  requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending','accepted')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);

CREATE TABLE IF NOT EXISTS lists (
  id INTEGER PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  visibility TEXT NOT NULL DEFAULT 'friends' CHECK (visibility IN ('private','friends','public')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS list_items (
  list_id INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  note TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (list_id, item_id)
);

-- Taste graph (DESIGN.md §9). A save is anything kept in another app; a spot
-- is a real-world event, place or product that saves can point to.
CREATE TABLE IF NOT EXISTS spots (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('event','place','product')),
  title TEXT NOT NULL,
  city TEXT,
  venue TEXT,
  creators TEXT NOT NULL DEFAULT '[]',
  tags TEXT NOT NULL DEFAULT '[]',
  description TEXT,
  starts_at TEXT,
  ends_at TEXT,
  opened_at TEXT,
  price TEXT,
  url TEXT,
  popularity REAL NOT NULL DEFAULT 0.5,
  source TEXT NOT NULL DEFAULT 'local',
  external_id TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  UNIQUE (source, external_id)
);
CREATE INDEX IF NOT EXISTS spots_city ON spots(city);

CREATE TABLE IF NOT EXISTS saves (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('song','place','look','product','art','food','event','other')),
  title TEXT NOT NULL,
  creator TEXT,
  source TEXT NOT NULL CHECK (source IN ('spotify','instagram','google_maps','pinterest','manual','tastemate')),
  collection TEXT,
  url TEXT,
  note TEXT,
  city TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  spot_id INTEGER REFERENCES spots(id) ON DELETE SET NULL,
  external_key TEXT,
  saved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, source, external_key)
);
CREATE INDEX IF NOT EXISTS saves_user ON saves(user_id);
CREATE INDEX IF NOT EXISTS saves_spot ON saves(spot_id);

CREATE TABLE IF NOT EXISTS spot_dismissals (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  spot_id INTEGER NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, spot_id)
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  home_city TEXT
);
`;

const JSON_COLS = ['creators', 'genres', 'moods'];

/** Turn a raw items row into an API object (JSON columns parsed, flags as booleans). */
export function hydrateItem(row) {
  if (!row) return row;
  const out = { ...row };
  for (const c of JSON_COLS) out[c] = typeof row[c] === 'string' ? JSON.parse(row[c]) : row[c] ?? [];
  out.is_demo = !!row.is_demo;
  return out;
}

export function openDb(file = process.env.DB_FILE || 'data/tastemate.db') {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(SCHEMA);
  return db;
}

/** Run fn inside a transaction. */
export function tx(db, fn) {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

/** Insert an item (or return the existing one with the same source/external_id). */
export function upsertItem(db, item) {
  if (item.external_id && item.source) {
    const existing = db
      .prepare('SELECT * FROM items WHERE source = ? AND external_id = ?')
      .get(item.source, String(item.external_id));
    if (existing) return hydrateItem(existing);
  }
  const r = db
    .prepare(
      `INSERT INTO items (medium, title, year, creators, genres, moods, description, image_url,
                          status, release_date, source, external_id, is_demo)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      item.medium,
      item.title,
      item.year ?? null,
      JSON.stringify(item.creators ?? []),
      JSON.stringify(item.genres ?? []),
      JSON.stringify(item.moods ?? []),
      item.description ?? null,
      item.image_url ?? null,
      item.status ?? 'released',
      item.release_date ?? null,
      item.source ?? 'local',
      item.external_id != null ? String(item.external_id) : null,
      item.is_demo ? 1 : 0
    );
  return hydrateItem(db.prepare('SELECT * FROM items WHERE id = ?').get(r.lastInsertRowid));
}

/** Parse a saves or spots row's JSON columns. */
export function hydrateSave(row) {
  return row && { ...row, tags: JSON.parse(row.tags || '[]') };
}

export function hydrateSpot(row) {
  return row && { ...row, tags: JSON.parse(row.tags || '[]'), creators: JSON.parse(row.creators || '[]'), is_demo: !!row.is_demo };
}

export function upsertSpot(db, s) {
  const existing = s.external_id && db.prepare('SELECT * FROM spots WHERE source = ? AND external_id = ?').get(s.source ?? 'local', String(s.external_id));
  if (existing) return hydrateSpot(existing);
  const r = db
    .prepare(
      `INSERT INTO spots (kind, title, city, venue, creators, tags, description, starts_at, ends_at, opened_at,
                          price, url, popularity, source, external_id, is_demo)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      s.kind, s.title, s.city ?? null, s.venue ?? null,
      JSON.stringify(s.creators ?? []), JSON.stringify(s.tags ?? []), s.description ?? null,
      s.starts_at ?? null, s.ends_at ?? null, s.opened_at ?? null, s.price ?? null, s.url ?? null,
      s.popularity ?? 0.5, s.source ?? 'local', s.external_id != null ? String(s.external_id) : null, s.is_demo ? 1 : 0
    );
  return hydrateSpot(db.prepare('SELECT * FROM spots WHERE id = ?').get(r.lastInsertRowid));
}

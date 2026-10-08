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

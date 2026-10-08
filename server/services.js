// Data-access helpers shared by the routes.
import { hydrateItem } from './db.js';
import { buildProfile, tasteSimilarity, toPercent } from './recommender.js';

export function friendIds(db, userId) {
  return db
    .prepare(
      `SELECT CASE WHEN requester_id = ? THEN addressee_id ELSE requester_id END AS id
         FROM friendships WHERE status = 'accepted' AND (requester_id = ? OR addressee_id = ?)`
    )
    .all(userId, userId, userId)
    .map((r) => r.id);
}

export function areFriends(db, a, b) {
  return !!db
    .prepare(
      `SELECT 1 FROM friendships WHERE status = 'accepted'
         AND ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))`
    )
    .get(a, b, b, a);
}

/** The user's library entries, each joined with its item. */
export function getLibrary(db, userId, state) {
  const rows = db
    .prepare(
      `SELECT ui.state, ui.score, ui.review, ui.updated_at, i.*
         FROM user_items ui JOIN items i ON i.id = ui.item_id
        WHERE ui.user_id = ? ${state ? 'AND ui.state = ?' : ''}
        ORDER BY ui.updated_at DESC`
    )
    .all(...(state ? [userId, state] : [userId]));
  return rows.map(splitEntry);
}

export function splitEntry(row) {
  const { state, score, review, updated_at, ...item } = row;
  return { state, score, review, updated_at, item: hydrateItem(item) };
}

export function getTagPrefs(db, userId) {
  return db.prepare('SELECT tag, weight FROM tag_prefs WHERE user_id = ?').all(userId);
}

export function getProfile(db, userId) {
  return buildProfile(getLibrary(db, userId), getTagPrefs(db, userId));
}

export function publicUser(u) {
  return u && { id: u.id, username: u.username, display_name: u.display_name };
}

/** The user's friends with their profiles and taste similarity to `profile`. */
export function friendsWithProfiles(db, userId, profile = getProfile(db, userId)) {
  const ids = friendIds(db, userId);
  if (!ids.length) return [];
  const users = db.prepare(`SELECT id, username, display_name FROM users WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids);
  return users.map((u) => {
    const p = getProfile(db, u.id);
    return { ...publicUser(u), name: u.display_name, profile: p, match: toPercent(tasteSimilarity(profile, p)) };
  });
}

/** Can `viewerId` see `list`? */
export function canViewList(db, viewerId, list) {
  if (!list) return false;
  if (list.owner_id === viewerId || list.visibility === 'public') return true;
  if (list.visibility === 'friends') return areFriends(db, viewerId, list.owner_id);
  return false;
}

/** item_id → [scores] across all users (community scores). */
export function communityScores(db) {
  const m = new Map();
  for (const r of db.prepare('SELECT item_id, score FROM user_items WHERE score IS NOT NULL').all()) {
    if (!m.has(r.item_id)) m.set(r.item_id, []);
    m.get(r.item_id).push(r.score);
  }
  return m;
}

/** item_id → [{ friendId, score }] for the given friends. */
export function friendScoresMap(db, ids) {
  const m = new Map();
  if (!ids.length) return m;
  const rows = db
    .prepare(`SELECT user_id, item_id, score FROM user_items WHERE score IS NOT NULL AND user_id IN (${ids.map(() => '?').join(',')})`)
    .all(...ids);
  for (const r of rows) {
    if (!m.has(r.item_id)) m.set(r.item_id, []);
    m.get(r.item_id).push({ friendId: r.user_id, score: r.score });
  }
  return m;
}

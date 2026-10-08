import { HttpError, intParam } from '../http.js';
import { requireUser } from '../auth.js';
import { hydrateItem } from '../db.js';
import { buildProfile, tasteSimilarity, toPercent, topTags } from '../recommender.js';
import {
  areFriends,
  canViewList,
  friendIds,
  friendsWithProfiles,
  getLibrary,
  getProfile,
  getTagPrefs,
  publicUser,
} from '../services.js';

const VISIBILITIES = ['private', 'friends', 'public'];

/** The first four items of a list, for the cover mosaic. */
function listCovers(db, listId) {
  return db
    .prepare('SELECT i.image_url, i.medium, i.title FROM list_items li JOIN items i ON i.id = li.item_id WHERE li.list_id = ? ORDER BY li.position LIMIT 4')
    .all(listId);
}

export default function socialRoutes(r, { db }) {
  // ----- Friends -----
  r.get('/friends', requireUser, (req, res) => {
    const me = req.user.id;
    const friends = friendsWithProfiles(db, me).map(({ profile, ...f }) => f).sort((a, b) => b.match - a.match);
    const incoming = db
      .prepare(`SELECT u.id, u.username, u.display_name FROM friendships f JOIN users u ON u.id = f.requester_id WHERE f.addressee_id = ? AND f.status = 'pending'`)
      .all(me);
    const outgoing = db
      .prepare(`SELECT u.id, u.username, u.display_name FROM friendships f JOIN users u ON u.id = f.addressee_id WHERE f.requester_id = ? AND f.status = 'pending'`)
      .all(me);
    res.json({ friends, incoming, outgoing });
  });

  r.post('/friends/request', requireUser, (req, res) => {
    const target = db.prepare('SELECT * FROM users WHERE username = ?').get(String(req.body?.username || ''));
    if (!target) throw new HttpError(404, 'No user with that username');
    if (target.id === req.user.id) throw new HttpError(400, "You can't add yourself");
    const existing = db
      .prepare('SELECT * FROM friendships WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)')
      .get(req.user.id, target.id, target.id, req.user.id);
    if (existing?.status === 'accepted') return res.json({ status: 'accepted' });
    if (existing && existing.requester_id === target.id) {
      // They already asked us, so accept it.
      db.prepare(`UPDATE friendships SET status = 'accepted' WHERE requester_id = ? AND addressee_id = ?`).run(target.id, req.user.id);
      return res.json({ status: 'accepted' });
    }
    if (!existing) db.prepare(`INSERT INTO friendships (requester_id, addressee_id, status) VALUES (?,?, 'pending')`).run(req.user.id, target.id);
    res.status(201).json({ status: 'pending' });
  });

  r.post('/friends/:id/accept', requireUser, (req, res) => {
    const { changes } = db
      .prepare(`UPDATE friendships SET status = 'accepted' WHERE requester_id = ? AND addressee_id = ? AND status = 'pending'`)
      .run(intParam(req.params.id), req.user.id);
    if (!changes) throw new HttpError(404, 'No pending request from that user');
    res.json({ status: 'accepted' });
  });

  // Unfriend, decline, or cancel a request.
  r.delete('/friends/:id', requireUser, (req, res) => {
    const other = intParam(req.params.id);
    db.prepare('DELETE FROM friendships WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)').run(req.user.id, other, other, req.user.id);
    res.json({ ok: true });
  });

  // ----- Users -----
  r.get('/users/search', requireUser, (req, res) => {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json({ users: [] });
    const like = `%${q.replace(/[%_\\]/g, (c) => '\\' + c)}%`;
    const users = db
      .prepare(`SELECT id, username, display_name FROM users WHERE (username LIKE ? ESCAPE '\\' OR display_name LIKE ? ESCAPE '\\') AND id <> ? LIMIT 20`)
      .all(like, like, req.user.id);
    res.json({ users });
  });

  // A user's profile. Library and reviews are visible to friends only.
  r.get('/users/:username', requireUser, (req, res) => {
    const u = db.prepare('SELECT id, username, display_name, created_at FROM users WHERE username = ?').get(req.params.username);
    if (!u) throw new HttpError(404, 'User not found');
    const me = req.user.id;
    const isSelf = u.id === me;
    const isFriend = isSelf || areFriends(db, me, u.id);
    const pending = db
      .prepare(`SELECT requester_id FROM friendships WHERE status = 'pending' AND ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))`)
      .get(me, u.id, u.id, me);
    const lists = db
      .prepare(`SELECT l.*, (SELECT COUNT(*) FROM list_items li WHERE li.list_id = l.id) AS count FROM lists l WHERE owner_id = ? ORDER BY updated_at DESC`)
      .all(u.id)
      .filter((l) => canViewList(db, me, l))
      .map((l) => ({ ...l, covers: listCovers(db, l.id) }));
    const out = {
      user: { ...publicUser(u), created_at: u.created_at },
      relationship: isSelf ? 'self' : isFriend ? 'friend' : pending ? (pending.requester_id === me ? 'requested' : 'incoming') : 'none',
      lists,
    };
    if (isFriend) {
      const library = getLibrary(db, u.id).filter((e) => e.state !== 'dismissed');
      const theirProfile = buildProfile(library, getTagPrefs(db, u.id));
      out.match = isSelf ? 100 : toPercent(tasteSimilarity(getProfile(db, me), theirProfile));
      out.taste = topTags(theirProfile, 10);
      out.recent = library.slice(0, 30);
      out.favourites = library.filter((e) => e.score >= 9).slice(0, 12);
    }
    res.json(out);
  });

  // ----- Lists -----
  r.get('/lists', requireUser, (req, res) => {
    const me = req.user.id;
    const fids = friendIds(db, me);
    const rows = db
      .prepare(
        `SELECT l.*, u.username AS owner_username, u.display_name AS owner_name,
                (SELECT COUNT(*) FROM list_items li WHERE li.list_id = l.id) AS count
           FROM lists l JOIN users u ON u.id = l.owner_id
          WHERE l.owner_id = ? OR l.visibility = 'public'
             OR (l.visibility = 'friends' AND l.owner_id IN (${fids.map(() => '?').join(',') || 'NULL'}))
          ORDER BY l.updated_at DESC LIMIT 200`
      )
      .all(me, ...fids);
    const withCovers = rows.map((l) => ({ ...l, covers: listCovers(db, l.id) }));
    res.json({
      mine: withCovers.filter((l) => l.owner_id === me),
      friends: withCovers.filter((l) => l.owner_id !== me && fids.includes(l.owner_id)),
      public: withCovers.filter((l) => l.owner_id !== me && !fids.includes(l.owner_id)),
    });
  });

  r.post('/lists', requireUser, (req, res) => {
    const { title, description, visibility = 'friends' } = req.body || {};
    if (!String(title || '').trim()) throw new HttpError(400, 'Title is required');
    if (!VISIBILITIES.includes(visibility)) throw new HttpError(400, 'Invalid visibility');
    const { lastInsertRowid } = db
      .prepare('INSERT INTO lists (owner_id, title, description, visibility) VALUES (?,?,?,?)')
      .run(req.user.id, String(title).trim().slice(0, 120), description ? String(description).slice(0, 1000) : null, visibility);
    res.status(201).json({ list: db.prepare('SELECT * FROM lists WHERE id = ?').get(lastInsertRowid) });
  });

  const ownList = (req) => {
    const list = db.prepare('SELECT * FROM lists WHERE id = ?').get(intParam(req.params.id));
    if (!list || list.owner_id !== req.user.id) throw new HttpError(404, 'List not found');
    return list;
  };

  r.get('/lists/:id', requireUser, (req, res) => {
    const list = db.prepare('SELECT l.*, u.username AS owner_username, u.display_name AS owner_name FROM lists l JOIN users u ON u.id = l.owner_id WHERE l.id = ?').get(intParam(req.params.id));
    if (!canViewList(db, req.user.id, list)) throw new HttpError(404, 'List not found');
    const items = db
      .prepare(
        `SELECT li.note, li.position, i.*, ui.score AS owner_score
           FROM list_items li JOIN items i ON i.id = li.item_id
           LEFT JOIN user_items ui ON ui.item_id = i.id AND ui.user_id = ?
          WHERE li.list_id = ? ORDER BY li.position, li.added_at`
      )
      .all(list.owner_id, list.id)
      .map(({ note, position, owner_score, ...row }) => ({ note, position, owner_score, item: hydrateItem(row) }));
    res.json({ list, items, isOwner: list.owner_id === req.user.id });
  });

  r.patch('/lists/:id', requireUser, (req, res) => {
    const list = ownList(req);
    const b = req.body || {};
    const title = b.title != null ? String(b.title).trim().slice(0, 120) : list.title;
    if (!title) throw new HttpError(400, 'Title is required');
    const visibility = b.visibility ?? list.visibility;
    if (!VISIBILITIES.includes(visibility)) throw new HttpError(400, 'Invalid visibility');
    const description = 'description' in b ? (b.description ? String(b.description).slice(0, 1000) : null) : list.description;
    db.prepare(`UPDATE lists SET title = ?, description = ?, visibility = ?, updated_at = datetime('now') WHERE id = ?`).run(title, description, visibility, list.id);
    res.json({ list: db.prepare('SELECT * FROM lists WHERE id = ?').get(list.id) });
  });

  r.delete('/lists/:id', requireUser, (req, res) => {
    db.prepare('DELETE FROM lists WHERE id = ?').run(ownList(req).id);
    res.json({ ok: true });
  });

  r.post('/lists/:id/items', requireUser, (req, res) => {
    const list = ownList(req);
    const itemId = intParam(req.body?.itemId, 'item id');
    if (!db.prepare('SELECT 1 FROM items WHERE id = ?').get(itemId)) throw new HttpError(404, 'Item not found');
    const { pos } = db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM list_items WHERE list_id = ?').get(list.id);
    db.prepare('INSERT INTO list_items (list_id, item_id, note, position) VALUES (?,?,?,?) ON CONFLICT (list_id, item_id) DO UPDATE SET note = excluded.note')
      .run(list.id, itemId, req.body?.note ? String(req.body.note).slice(0, 500) : null, pos);
    db.prepare(`UPDATE lists SET updated_at = datetime('now') WHERE id = ?`).run(list.id);
    res.status(201).json({ ok: true });
  });

  r.delete('/lists/:id/items/:itemId', requireUser, (req, res) => {
    const list = ownList(req);
    db.prepare('DELETE FROM list_items WHERE list_id = ? AND item_id = ?').run(list.id, intParam(req.params.itemId, 'item id'));
    res.json({ ok: true });
  });

  // ----- Feed: friends' recent ratings, reviews and lists -----
  r.get('/feed', requireUser, (req, res) => {
    const fids = friendIds(db, req.user.id);
    if (!fids.length) return res.json({ events: [] });
    const ph = fids.map(() => '?').join(',');
    const activity = db
      .prepare(
        `SELECT 'entry' AS kind, ui.updated_at AS at, ui.state, ui.score, ui.review,
                u.id AS user_id, u.username, u.display_name, i.*
           FROM user_items ui JOIN users u ON u.id = ui.user_id JOIN items i ON i.id = ui.item_id
          WHERE ui.user_id IN (${ph}) AND ui.state <> 'dismissed'
          ORDER BY ui.updated_at DESC LIMIT 60`
      )
      .all(...fids)
      .map(({ kind, at, state, score, review, user_id, username, display_name, ...item }) => ({
        kind, at, state, score, review, user: { id: user_id, username, display_name }, item: hydrateItem(item),
      }));
    const lists = db
      .prepare(
        `SELECT 'list' AS kind, l.updated_at AS at, l.id, l.title, l.description,
                u.id AS user_id, u.username, u.display_name,
                (SELECT COUNT(*) FROM list_items li WHERE li.list_id = l.id) AS count
           FROM lists l JOIN users u ON u.id = l.owner_id
          WHERE l.owner_id IN (${ph}) AND l.visibility <> 'private'
          ORDER BY l.updated_at DESC LIMIT 20`
      )
      .all(...fids)
      .map(({ kind, at, user_id, username, display_name, ...list }) => ({ kind, at, user: { id: user_id, username, display_name }, list }));
    const events = [...activity, ...lists].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 60);
    res.json({ events });
  });
}

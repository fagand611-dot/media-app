import { HttpError, ah, intParam } from '../http.js';
import { requireUser } from '../auth.js';
import { hydrateItem, upsertItem } from '../db.js';
import { searchExternal } from '../providers/index.js';
import { MEDIA, MOODS, moodsForGenres, normalizeGenres } from '../taxonomy.js';
import { friendIds, getLibrary, splitEntry } from '../services.js';

const STATES = ['want', 'in_progress', 'done', 'dismissed'];
const STATUSES = ['released', 'upcoming', 'in_production', 'announced'];

/** Validate and clean an item submitted by a client (manual add or external import). */
export function cleanItemInput(body) {
  const b = body || {};
  if (!MEDIA.includes(b.medium)) throw new HttpError(400, 'Invalid medium');
  const title = String(b.title || '').trim();
  if (!title) throw new HttpError(400, 'Title is required');
  const strList = (v, max) => (Array.isArray(v) ? v : []).map((x) => String(x).trim()).filter(Boolean).slice(0, max);
  const genres = normalizeGenres(strList(b.genres, 8));
  const moods = strList(b.moods, 8).map((m) => m.toLowerCase()).filter((m) => MOODS.includes(m));
  const year = b.year ? Number(b.year) : null;
  if (year != null && !(Number.isInteger(year) && year > 0 && year < 3000)) throw new HttpError(400, 'Invalid year');
  const imageUrl = typeof b.image_url === 'string' && /^https:\/\//.test(b.image_url) ? b.image_url : null;
  return {
    medium: b.medium,
    title: title.slice(0, 200),
    year,
    creators: strList(b.creators, 5).map((c) => c.slice(0, 100)),
    genres,
    moods: moods.length ? moods : moodsForGenres(genres),
    description: b.description ? String(b.description).slice(0, 2000) : null,
    image_url: imageUrl,
    status: STATUSES.includes(b.status) ? b.status : 'released',
    release_date: /^\d{4}-\d{2}-\d{2}$/.test(b.release_date || '') ? b.release_date : null,
  };
}

export default function itemRoutes(r, { db, providers }) {
  r.get('/items/:id', requireUser, (req, res) => {
    const id = intParam(req.params.id);
    const item = hydrateItem(db.prepare('SELECT * FROM items WHERE id = ?').get(id));
    if (!item) throw new HttpError(404, 'Item not found');
    const mine = db.prepare('SELECT state, score, review, updated_at FROM user_items WHERE user_id = ? AND item_id = ?').get(req.user.id, id) || null;

    const fids = friendIds(db, req.user.id);
    const friends = fids.length
      ? db
          .prepare(
            `SELECT u.id, u.username, u.display_name, ui.state, ui.score, ui.review, ui.updated_at
               FROM user_items ui JOIN users u ON u.id = ui.user_id
              WHERE ui.item_id = ? AND ui.state <> 'dismissed' AND ui.user_id IN (${fids.map(() => '?').join(',')})
              ORDER BY ui.updated_at DESC`
          )
          .all(id, ...fids)
      : [];
    const stats = db.prepare('SELECT COUNT(score) AS n, AVG(score) AS avg FROM user_items WHERE item_id = ?').get(id);
    const lists = db
      .prepare(
        `SELECT l.id, l.title, l.owner_id, u.display_name AS owner_name
           FROM list_items li JOIN lists l ON l.id = li.list_id JOIN users u ON u.id = l.owner_id
          WHERE li.item_id = ? AND (l.owner_id = ? OR l.visibility = 'public'
                OR (l.visibility = 'friends' AND l.owner_id IN (${fids.map(() => '?').join(',') || 'NULL'})))`
      )
      .all(id, req.user.id, ...fids);
    res.json({
      item,
      mine,
      friends,
      community: { count: stats.n, avg: stats.avg != null ? +stats.avg.toFixed(1) : null },
      lists,
    });
  });

  // Search the local catalogue, plus external providers when external=1.
  r.get('/search', requireUser, ah(async (req, res) => {
    const q = String(req.query.q || '').trim();
    const medium = MEDIA.includes(req.query.medium) ? req.query.medium : null;
    if (q.length < 2) return res.json({ local: [], external: [], errors: [] });
    const like = `%${q.replace(/[%_\\]/g, (c) => '\\' + c)}%`;
    const local = db
      .prepare(
        `SELECT * FROM items WHERE (title LIKE ? ESCAPE '\\' OR creators LIKE ? ESCAPE '\\')
           ${medium ? 'AND medium = ?' : ''} ORDER BY year DESC LIMIT 30`
      )
      .all(...[like, like, ...(medium ? [medium] : [])])
      .map(hydrateItem);

    let external = [];
    let errors = [];
    if (req.query.external === '1' && providers.length) {
      ({ results: external, errors } = await searchExternal(providers, q, medium));
      // Mark results already imported, so the client links to them instead.
      const find = db.prepare('SELECT id FROM items WHERE source = ? AND external_id = ?');
      external = external.map((e) => ({ ...e, local_id: find.get(e.source, String(e.external_id))?.id ?? null }));
    }
    res.json({ local, external, errors, providers: providers.map((p) => p.name) });
  }));

  // Import an external search result, or add an item by hand.
  r.post('/items', requireUser, (req, res) => {
    const clean = cleanItemInput(req.body);
    const b = req.body || {};
    const source = providers.some((p) => p.name === b.source) && b.external_id ? b.source : 'user';
    const item = upsertItem(db, { ...clean, source, external_id: source === 'user' ? null : String(b.external_id) });
    res.status(201).json({ item });
  });

  // ----- Library: ratings, reviews, want / not-for-me -----

  r.get('/library', requireUser, (req, res) => {
    const state = STATES.includes(req.query.state) ? req.query.state : undefined;
    res.json({ entries: getLibrary(db, req.user.id, state) });
  });

  r.put('/library/:itemId', requireUser, (req, res) => {
    const itemId = intParam(req.params.itemId, 'item id');
    if (!db.prepare('SELECT 1 FROM items WHERE id = ?').get(itemId)) throw new HttpError(404, 'Item not found');
    const prev = db.prepare('SELECT * FROM user_items WHERE user_id = ? AND item_id = ?').get(req.user.id, itemId);
    const b = req.body || {};

    let score = 'score' in b ? b.score : prev?.score ?? null;
    if (score != null && !(Number.isInteger(score) && score >= 1 && score <= 10)) throw new HttpError(400, 'Score must be a whole number from 1 to 10');
    let review = 'review' in b ? (b.review ? String(b.review).slice(0, 5000) : null) : prev?.review ?? null;
    // Scoring or reviewing something means you've finished it, unless you say otherwise.
    let state = b.state ?? (score != null || review ? 'done' : prev?.state);
    if (!STATES.includes(state)) throw new HttpError(400, 'Invalid state');
    if (state === 'dismissed') {
      score = null;
      review = null;
    }

    db.prepare(
      `INSERT INTO user_items (user_id, item_id, state, score, review, updated_at)
       VALUES (?,?,?,?,?,datetime('now'))
       ON CONFLICT (user_id, item_id) DO UPDATE SET state = excluded.state, score = excluded.score,
         review = excluded.review, updated_at = excluded.updated_at`
    ).run(req.user.id, itemId, state, score, review);
    const row = db
      .prepare('SELECT ui.state, ui.score, ui.review, ui.updated_at, i.* FROM user_items ui JOIN items i ON i.id = ui.item_id WHERE ui.user_id = ? AND ui.item_id = ?')
      .get(req.user.id, itemId);
    res.json({ entry: splitEntry(row) });
  });

  r.delete('/library/:itemId', requireUser, (req, res) => {
    db.prepare('DELETE FROM user_items WHERE user_id = ? AND item_id = ?').run(req.user.id, intParam(req.params.itemId, 'item id'));
    res.json({ ok: true });
  });
}

import { HttpError, ah } from '../http.js';
import { requireUser } from '../auth.js';
import { hydrateItem, tx, upsertItem } from '../db.js';
import { MEDIA, GENRES, MOODS } from '../taxonomy.js';
import { buildProfile, cosine, itemFeatures, recommend, toPercent, topTags } from '../recommender.js';
import {
  communityScores,
  friendScoresMap,
  friendsWithProfiles,
  getLibrary,
  getProfile,
  getTagPrefs,
} from '../services.js';

const TAG_RE = /^(genre|mood|creator):.{1,100}$/;

export default function discoverRoutes(r, { db, providers }) {
  // ----- Recommendations -----
  r.get('/recommendations', requireUser, (req, res) => {
    const medium = MEDIA.includes(req.query.medium) ? req.query.medium : null;
    const limit = Math.min(Math.max(Number(req.query.limit) || 24, 1), 60);
    const library = getLibrary(db, req.user.id);
    const profile = buildProfile(library, getTagPrefs(db, req.user.id));
    const seen = new Set(library.map((e) => e.item.id));
    const candidates = db
      .prepare(`SELECT * FROM items WHERE status = 'released' ${medium ? 'AND medium = ?' : ''}`)
      .all(...(medium ? [medium] : []))
      .map(hydrateItem)
      .filter((i) => !seen.has(i.id));
    const friends = friendsWithProfiles(db, req.user.id, profile);
    const recs = recommend({
      profile,
      library,
      candidates,
      friends,
      friendScores: friendScoresMap(db, friends.map((f) => f.id)),
      communityScores: communityScores(db),
      limit,
      diversify: !medium,
    });
    res.json({ recommendations: recs, profileSize: profile.size });
  });

  // ----- Radar: upcoming and in-production work, ranked by taste -----
  r.get('/radar', requireUser, (req, res) => {
    const medium = MEDIA.includes(req.query.medium) ? req.query.medium : null;
    const profile = getProfile(db, req.user.id);
    const mine = new Map(db.prepare('SELECT item_id, state FROM user_items WHERE user_id = ?').all(req.user.id).map((r) => [r.item_id, r.state]));
    const items = db
      .prepare(`SELECT * FROM items WHERE status <> 'released' ${medium ? 'AND medium = ?' : ''}`)
      .all(...(medium ? [medium] : []))
      .map(hydrateItem)
      .filter((i) => mine.get(i.id) !== 'dismissed')
      .map((item) => ({
        item,
        match: toPercent(cosine(profile, itemFeatures(item))),
        watching: mine.get(item.id) === 'want',
      }))
      .sort((a, b) => b.watching - a.watching || b.match - a.match || (a.item.release_date || '9').localeCompare(b.item.release_date || '9'));
    res.json({ radar: items, canRefresh: providers.some((p) => p.upcoming) });
  });

  // Pull fresh upcoming titles from providers that support it (TMDB).
  r.post('/radar/refresh', requireUser, ah(async (_req, res) => {
    let added = 0;
    const errors = [];
    for (const p of providers.filter((p) => p.upcoming)) {
      try {
        for (const item of await p.upcoming()) {
          const before = db.prepare('SELECT 1 FROM items WHERE source = ? AND external_id = ?').get(item.source, item.external_id);
          upsertItem(db, item);
          if (!before) added++;
        }
      } catch (e) {
        errors.push({ provider: p.name, error: e.message });
      }
    }
    res.json({ added, errors });
  }));

  // ----- Taste DNA -----
  r.get('/taste', requireUser, (req, res) => {
    const library = getLibrary(db, req.user.id);
    const prefs = getTagPrefs(db, req.user.id);
    const profile = buildProfile(library, prefs);
    const rated = library.filter((e) => e.score != null);
    const byMedium = Object.fromEntries(MEDIA.map((m) => [m, rated.filter((e) => e.item.medium === m).length]));
    res.json({ ...topTags(profile, 14), prefs, counts: { rated: rated.length, byMedium } });
  });

  // Pin (positive weight), ban (negative) or clear (0) a tag.
  r.put('/taste/tags', requireUser, (req, res) => {
    const { tag, weight } = req.body || {};
    if (!TAG_RE.test(tag || '')) throw new HttpError(400, 'Invalid tag');
    const w = Number(weight);
    if (!Number.isFinite(w) || Math.abs(w) > 2) throw new HttpError(400, 'Weight must be between -2 and 2');
    if (w === 0) db.prepare('DELETE FROM tag_prefs WHERE user_id = ? AND tag = ?').run(req.user.id, tag);
    else
      db.prepare('INSERT INTO tag_prefs (user_id, tag, weight) VALUES (?,?,?) ON CONFLICT (user_id, tag) DO UPDATE SET weight = excluded.weight')
        .run(req.user.id, tag, w);
    res.json({ prefs: getTagPrefs(db, req.user.id) });
  });

  // ----- Onboarding -----

  // Well-known titles to rate first: the most-rated in each medium, picked so
  // they cover as many different genres as possible.
  r.get('/onboarding/starters', requireUser, (_req, res) => {
    const starters = {};
    for (const m of MEDIA) {
      const pool = db
        .prepare(
          `SELECT i.*, COUNT(ui.score) AS n FROM items i LEFT JOIN user_items ui ON ui.item_id = i.id
            WHERE i.medium = ? AND i.status = 'released' GROUP BY i.id ORDER BY n DESC, i.id LIMIT 40`
        )
        .all(m)
        .map(({ n, ...row }) => hydrateItem(row));
      starters[m] = spreadByGenre(pool, 8);
    }
    res.json({ starters, genres: GENRES, moods: MOODS });
  });

  r.post('/onboarding', requireUser, (req, res) => {
    const { tags = [], ratings = [] } = req.body || {};
    if (!Array.isArray(tags) || !Array.isArray(ratings)) throw new HttpError(400, 'Bad request');
    tx(db, () => {
      const putTag = db.prepare('INSERT INTO tag_prefs (user_id, tag, weight) VALUES (?,?,1) ON CONFLICT (user_id, tag) DO UPDATE SET weight = 1');
      for (const t of tags.slice(0, 80)) if (TAG_RE.test(t)) putTag.run(req.user.id, t);
      const rate = db.prepare(
        `INSERT INTO user_items (user_id, item_id, state, score) VALUES (?,?, 'done', ?)
         ON CONFLICT (user_id, item_id) DO UPDATE SET state = 'done', score = excluded.score, updated_at = datetime('now')`
      );
      const exists = db.prepare('SELECT 1 FROM items WHERE id = ?');
      for (const { itemId, score } of ratings.slice(0, 100)) {
        if (Number.isInteger(itemId) && Number.isInteger(score) && score >= 1 && score <= 10 && exists.get(itemId)) rate.run(req.user.id, itemId, score);
      }
      db.prepare('UPDATE users SET onboarded = 1 WHERE id = ?').run(req.user.id);
    });
    res.json({ ok: true });
  });
}

/** Pick up to n items, preferring ones that add a genre not yet covered. */
export function spreadByGenre(pool, n) {
  const picked = [];
  const covered = new Set();
  const rest = [...pool];
  while (picked.length < n && rest.length) {
    let best = 0;
    let bestGain = -1;
    rest.forEach((it, i) => {
      const gain = it.genres.filter((g) => !covered.has(g)).length;
      if (gain > bestGain) [best, bestGain] = [i, gain];
    });
    const [it] = rest.splice(best, 1);
    it.genres.forEach((g) => covered.add(g));
    picked.push(it);
  }
  return picked;
}

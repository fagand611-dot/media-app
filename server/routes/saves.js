import { HttpError, intParam } from '../http.js';
import { requireUser } from '../auth.js';
import { hydrateItem, hydrateSave, hydrateSpot, tx } from '../db.js';
import { parseImport } from '../importers.js';
import { SAVE_KINDS, SAVE_SOURCES, autoTag, cleanTags, guessKind } from '../taxonomy.js';
import { findPatterns, rankSpots, tasteProfile, topSaveTags } from '../taste-graph.js';
import { friendIds, getProfile } from '../services.js';

const IMPORT_SOURCES = ['spotify', 'instagram', 'google_maps', 'pinterest'];
const PER_KIND = { event: 12, place: 12, product: 8 };
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export default function savesRoutes(r, { db }) {
  const getSaves = (userId) => db.prepare('SELECT * FROM saves WHERE user_id = ? ORDER BY COALESCE(saved_at, created_at) DESC, id DESC').all(userId).map(hydrateSave);
  const cities = () => db.prepare('SELECT DISTINCT city FROM spots WHERE city IS NOT NULL ORDER BY city').all().map((x) => x.city);
  const homeCity = (userId) => db.prepare('SELECT home_city FROM user_settings WHERE user_id = ?').get(userId)?.home_city ?? null;
  const ownSave = (req) => {
    const s = db.prepare('SELECT * FROM saves WHERE id = ? AND user_id = ?').get(intParam(req.params.id), req.user.id);
    if (!s) throw new HttpError(404, 'Save not found');
    return hydrateSave(s);
  };

  // ----- Saves -----
  r.get('/saves', requireUser, (req, res) => {
    const all = getSaves(req.user.id);
    const count = (key) => all.reduce((m, s) => ({ ...m, [s[key]]: (m[s[key]] || 0) + 1 }), {});
    res.json({ saves: all, counts: { kind: count('kind'), source: count('source') }, kinds: SAVE_KINDS, sources: SAVE_SOURCES });
  });

  r.post('/saves', requireUser, (req, res) => {
    const b = req.body || {};
    const title = String(b.title || '').trim().slice(0, 200);
    if (!title) throw new HttpError(400, 'Title is required');
    const text = [title, b.creator, b.note, b.collection].map((x) => (x ? String(x).slice(0, 500) : null));
    const tags = cleanTags([...(b.tags || []), ...autoTag(...text)]);
    const kind = SAVE_KINDS.includes(b.kind) ? b.kind : guessKind(tags);
    const id = db
      .prepare(`INSERT INTO saves (user_id, kind, title, creator, source, collection, url, note, city, tags) VALUES (?,?,?,?, 'manual', ?,?,?,?,?)`)
      .run(req.user.id, kind, title, text[1], text[3], cleanUrl(b.url), text[2], cleanCity(b.city), JSON.stringify(tags)).lastInsertRowid;
    res.status(201).json({ save: hydrateSave(db.prepare('SELECT * FROM saves WHERE id = ?').get(id)) });
  });

  r.patch('/saves/:id', requireUser, (req, res) => {
    const s = ownSave(req);
    const b = req.body || {};
    const next = {
      kind: SAVE_KINDS.includes(b.kind) ? b.kind : s.kind,
      tags: b.tags !== undefined ? cleanTags(b.tags) : s.tags,
      note: b.note !== undefined ? (String(b.note).slice(0, 500) || null) : s.note,
      city: b.city !== undefined ? cleanCity(b.city) : s.city,
    };
    db.prepare('UPDATE saves SET kind = ?, tags = ?, note = ?, city = ? WHERE id = ?').run(next.kind, JSON.stringify(next.tags), next.note, next.city, s.id);
    res.json({ save: { ...s, ...next } });
  });

  r.delete('/saves/:id', requireUser, (req, res) => {
    db.prepare('DELETE FROM saves WHERE id = ?').run(ownSave(req).id);
    res.json({ ok: true });
  });

  // Import a data-export file from another app. Re-importing the same file
  // is safe: rows already imported (same source and key) are skipped.
  r.post('/saves/import', requireUser, (req, res) => {
    const { source, text } = req.body || {};
    if (!IMPORT_SOURCES.includes(source)) throw new HttpError(400, 'Unknown source');
    const rows = parseImport(source, text, { cities: cities() });
    const artistTags = musicTagsByArtist(db);
    let added = 0;
    let untagged = 0;
    tx(db, () => {
      const ins = db.prepare(
        `INSERT OR IGNORE INTO saves (user_id, kind, title, creator, source, collection, url, note, city, tags, external_key, saved_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
      );
      for (const row of rows) {
        // Artists already in the music catalogue lend their genres and moods to the song.
        const fromCatalogue = (row.creator && artistTags.get(row.creator.toLowerCase())) || [];
        const tags = cleanTags([...autoTag(row.title, row.creator, row.collection, row.note), ...fromCatalogue]);
        const kind = row.kind === 'other' ? guessKind(tags) : row.kind;
        const r2 = ins.run(req.user.id, kind, row.title, row.creator ?? null, source, row.collection ?? null, row.url ?? null, row.note ?? null, row.city ?? null, JSON.stringify(tags), String(row.external_key).slice(0, 500), row.saved_at ?? null);
        if (r2.changes) {
          added++;
          if (!tags.length) untagged++;
        }
      }
    });
    res.json({ found: rows.length, added, skipped: rows.length - added, untagged });
  });

  // ----- The graph: tag weights and cross-app patterns -----
  r.get('/graph', requireUser, (req, res) => {
    const saves = getSaves(req.user.id);
    const profile = tasteProfile(saves, getProfile(db, req.user.id));
    const savedCities = {};
    for (const s of saves) if (s.city) savedCities[s.city] = (savedCities[s.city] || 0) + 1;
    res.json({ tags: topSaveTags(profile), patterns: findPatterns(saves), total: saves.length, untagged: saves.filter((s) => !s.tags.length).length, cities: savedCities });
  });

  // ----- Next: what to do, see and buy in a city, for a date range -----
  r.get('/next', requireUser, (req, res) => {
    const me = req.user.id;
    const known = cities();
    const asked = typeof req.query.city === 'string' ? req.query.city : null;
    const city = asked === 'anywhere' ? null : known.find((c) => c.toLowerCase() === (asked || homeCity(me) || '').toLowerCase()) || null;
    const today = new Date().toISOString().slice(0, 10);
    const from = ISO_DATE.test(req.query.from) ? req.query.from : today;
    const to = ISO_DATE.test(req.query.to) ? req.query.to : addDays(from, 14);
    if (to < from) throw new HttpError(400, 'The end date is before the start date');

    const saves = getSaves(me);
    const profile = tasteProfile(saves, getProfile(db, me));
    const spots = db.prepare('SELECT * FROM spots').all().map(hydrateSpot);
    const savedSpots = new Set(saves.filter((s) => s.spot_id).map((s) => s.spot_id));
    const dismissed = db.prepare('SELECT spot_id FROM spot_dismissals WHERE user_id = ?').all(me).map((x) => x.spot_id);

    const fids = friendIds(db, me);
    const friendSaves = new Map();
    if (fids.length) {
      const rows = db
        .prepare(`SELECT s.spot_id, u.display_name FROM saves s JOIN users u ON u.id = s.user_id WHERE s.spot_id IS NOT NULL AND s.user_id IN (${fids.map(() => '?').join(',')})`)
        .all(...fids);
      for (const x of rows) friendSaves.set(x.spot_id, [...(friendSaves.get(x.spot_id) || []), x.display_name]);
    }

    const ranked = rankSpots({ profile, saves, spots, city, from, to, friendSaves, exclude: new Set([...savedSpots, ...dismissed]), today });
    const group = (kind) => ranked.filter((x) => x.spot.kind === kind).slice(0, PER_KIND[kind]);
    res.json({
      city,
      homeCity: homeCity(me),
      from,
      to,
      cities: known,
      events: group('event'),
      places: group('place'),
      products: group('product'),
      // What you already saved there and may have forgotten about.
      yourSaves: city ? saves.filter((s) => s.city?.toLowerCase() === city.toLowerCase() && !s.spot_id) : [],
      saved: saves.filter((s) => s.spot_id && (!city || !s.city || s.city.toLowerCase() === city.toLowerCase())).map((s) => ({ ...s, spot: hydrateSpot(db.prepare('SELECT * FROM spots WHERE id = ?').get(s.spot_id)) })),
      profileSize: profile.size,
    });
  });

  const getSpot = (req) => {
    const s = db.prepare('SELECT * FROM spots WHERE id = ?').get(intParam(req.params.id));
    if (!s) throw new HttpError(404, 'Spot not found');
    return hydrateSpot(s);
  };

  // Saving a spot makes it a save like any other, so it feeds the graph too.
  r.post('/spots/:id/save', requireUser, (req, res) => {
    const spot = getSpot(req);
    db.prepare(
      `INSERT OR IGNORE INTO saves (user_id, kind, title, creator, source, url, city, tags, spot_id, external_key)
       VALUES (?,?,?,?, 'tastemate', ?,?,?,?,?)`
    ).run(req.user.id, spot.kind, spot.title, spot.creators[0] ?? null, spot.url, spot.city, JSON.stringify(spot.tags), spot.id, `spot:${spot.id}`);
    db.prepare('DELETE FROM spot_dismissals WHERE user_id = ? AND spot_id = ?').run(req.user.id, spot.id);
    res.json({ ok: true });
  });

  r.delete('/spots/:id/save', requireUser, (req, res) => {
    db.prepare('DELETE FROM saves WHERE user_id = ? AND spot_id = ?').run(req.user.id, getSpot(req).id);
    res.json({ ok: true });
  });

  r.post('/spots/:id/dismiss', requireUser, (req, res) => {
    const spot = getSpot(req);
    db.prepare('INSERT OR IGNORE INTO spot_dismissals (user_id, spot_id) VALUES (?,?)').run(req.user.id, spot.id);
    res.json({ ok: true });
  });

  r.put('/settings', requireUser, (req, res) => {
    const home = cleanCity(req.body?.home_city);
    db.prepare('INSERT INTO user_settings (user_id, home_city) VALUES (?,?) ON CONFLICT (user_id) DO UPDATE SET home_city = excluded.home_city').run(req.user.id, home);
    res.json({ home_city: home });
  });
}

/** artist (lower case) → genres and moods of their records in the catalogue. */
function musicTagsByArtist(db) {
  const m = new Map();
  for (const row of db.prepare(`SELECT * FROM items WHERE medium = 'music'`).all()) {
    const it = hydrateItem(row);
    for (const c of it.creators) m.set(c.toLowerCase(), [...new Set([...(m.get(c.toLowerCase()) || []), ...it.genres, ...it.moods])]);
  }
  return m;
}

function cleanUrl(u) {
  const s = String(u || '').trim();
  return /^https?:\/\/\S+$/i.test(s) ? s.slice(0, 500) : null;
}

function cleanCity(c) {
  const s = String(c || '').trim().slice(0, 80);
  return s || null;
}

function addDays(iso, n) {
  return new Date(Date.parse(iso) + n * 864e5).toISOString().slice(0, 10);
}

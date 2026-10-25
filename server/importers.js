// Parse the data exports people can download from each app into saves.
// None of these platforms offer an API for "everything I saved", but each
// lets you download your own data, so importing that file is the reliable
// path today:
//
//   Spotify      Account → Privacy → "Download your data" → YourLibrary.json
//   Instagram    Accounts Centre → "Download your information" (JSON) →
//                saved_posts.json / saved_collections.json
//   Google Maps  Google Takeout → "Saved" → Saved Places.json, or a list as CSV
//   Pinterest    Settings → "Request your data", or paste pin titles
//
// Every parser is tolerant: exports change shape over time, so we look for
// the fields we need rather than insisting on one exact layout.
// Each returns [{ kind, title, creator, url, note, city, collection, external_key, saved_at }].
import { HttpError } from './http.js';

const MAX_ROWS = 5000;

export function parseImport(source, text, { cities = [] } = {}) {
  const raw = String(text ?? '').trim();
  if (!raw) throw new HttpError(400, 'The file is empty');
  const json = raw.startsWith('{') || raw.startsWith('[') ? tryJson(raw) : null;
  const rows =
    source === 'spotify' ? spotify(json, raw)
    : source === 'instagram' ? instagram(json, raw)
    : source === 'google_maps' ? googleMaps(json, raw, cities)
    : source === 'pinterest' ? lines(raw, 'look')
    : null;
  if (!rows) throw new HttpError(400, 'Unknown source');
  if (!rows.length) throw new HttpError(400, 'No saves found in that file. Check it is the right export for this app.');
  return rows.slice(0, MAX_ROWS).map((r) => ({ ...r, title: String(r.title).slice(0, 200) }));
}

function tryJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    throw new HttpError(400, 'That file looks like JSON but could not be read');
  }
}

// ----- Spotify -----
// YourLibrary.json: { tracks: [{ artist, album, track, uri }], albums: [...], artists: [...] }
// Also accepts the Web API shape ({ items: [{ track: { name, artists, ... } }] })
// or plain "Artist - Track" lines.
function spotify(json, raw) {
  if (!json) return lines(raw, 'song', (l) => {
    const [a, t] = l.split(/\s+[-–]\s+/);
    return t ? { title: t, creator: a } : { title: l };
  });
  const tracks = json.tracks || json.items || (Array.isArray(json) ? json : []);
  const out = [];
  for (const t of tracks) {
    // In YourLibrary.json `track` is the title; in the Web API it's an object.
    const tr = t.track && typeof t.track === 'object' ? t.track : t;
    const title = tr.track || tr.name || tr.trackName;
    const creator = tr.artist || tr.artistName || tr.artists?.map((a) => a.name).join(', ');
    if (!title) continue;
    out.push({
      kind: 'song',
      title,
      creator: creator || null,
      collection: tr.album?.name || tr.album || null,
      url: uriToUrl(tr.uri) || tr.external_urls?.spotify || null,
      external_key: tr.uri || `${creator}|${title}`,
      saved_at: t.added_at || null,
    });
  }
  for (const a of json.albums || []) {
    if (!a.album) continue;
    out.push({ kind: 'song', title: a.album, creator: a.artist || null, url: uriToUrl(a.uri), external_key: a.uri || `album|${a.artist}|${a.album}` });
  }
  return out;
}

function uriToUrl(uri) {
  const m = /^spotify:(track|album|artist):(\w+)$/.exec(uri || '');
  return m ? `https://open.spotify.com/${m[1]}/${m[2]}` : null;
}

// ----- Instagram -----
// saved_posts.json:       { saved_saved_media: [{ title: "<account>", string_map_data: { "Saved on": { href, timestamp } } }] }
// saved_collections.json: { saved_saved_collections: [ header { string_map_data: { Name: { value } } }, then its posts ... ] }
// The export has no captions, only the account and the link, so the account
// name and your collection names are the signal. Naming collections well
// ("Pastry", "Coats") makes a big difference.
function instagram(json, raw) {
  if (!json) return lines(raw, 'other', (l) => (/^https?:/.test(l) ? { title: 'Instagram post', url: l } : { title: l }));
  const out = [];
  let collection = null;
  const visit = (entry) => {
    const m = entry.string_map_data || {};
    // A collection header: has a Name, no link.
    const name = m.Name?.value;
    const link = m['Saved on']?.href || m['Added Time']?.href || m.Name?.href || entry.href;
    if (name && !link) {
      collection = name;
      return;
    }
    if (!link) return;
    const account = entry.title || name || null;
    const ts = m['Saved on']?.timestamp || m['Added Time']?.timestamp;
    out.push({
      kind: 'other',
      title: account ? `@${account}` : 'Instagram post',
      creator: account,
      collection,
      url: link,
      external_key: link,
      saved_at: ts ? new Date(ts * 1000).toISOString() : null,
    });
  };
  const lists = Array.isArray(json) ? [json] : Object.values(json).filter(Array.isArray);
  for (const list of lists) {
    collection = null;
    list.forEach(visit);
  }
  return out;
}

// ----- Google Maps -----
// Saved Places.json (GeoJSON). Newer exports put the name under
// properties.location.name; older ones under properties.Title and
// properties.Location["Business Name"]. Lists export as CSV: Title,Note,URL,Comment.
function googleMaps(json, raw, cities) {
  if (!json) return csv(raw).map((r) => place(r.title || r.name, r.note || r.comment, r.url, r.address, null, cities)).filter(Boolean);
  const features = json.features || (Array.isArray(json) ? json : []);
  return features
    .map((f) => {
      const p = f.properties || f;
      const loc = p.location || p.Location || {};
      const title = loc.name || loc['Business Name'] || p.Title || p.name;
      const address = loc.address || loc.Address || p.address;
      return place(title, p.Comment || p.comment || p.note, p.google_maps_url || p['Google Maps URL'] || p.url, address, p.date || p.Published, cities);
    })
    .filter(Boolean);
}

function place(title, note, url, address, date, cities) {
  if (!title) return null;
  return {
    kind: 'place',
    title,
    note: note || null,
    url: url || null,
    city: cityFrom(address, cities) || cityFrom(note, cities),
    external_key: url || `${title}|${address || ''}`,
    saved_at: date || null,
  };
}

/** Find a known city name inside an address. */
export function cityFrom(text, cities) {
  if (!text) return null;
  const s = String(text).toLowerCase();
  return cities.find((c) => new RegExp(`(^|[^a-z])${c.toLowerCase()}([^a-z]|$)`).test(s)) || null;
}

// ----- Generic helpers -----

/** One save per non-empty line. */
function lines(raw, kind, map = (l) => ({ title: l })) {
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const r = map(l);
      return { kind, ...r, external_key: r.url || `${r.creator || ''}|${r.title}` };
    });
}

/** Minimal CSV reader (quoted fields, commas, newlines in quotes). Header row → lower-case keys. */
export function csv(raw) {
  const rows = [];
  let row = [];
  let field = '';
  let q = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (q) {
      if (c === '"' && raw[i + 1] === '"') (field += '"'), i++;
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') row.push(field), (field = '');
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && raw[i + 1] === '\n') i++;
      row.push(field), rows.push(row), (row = []), (field = '');
    } else field += c;
  }
  if (field || row.length) row.push(field), rows.push(row);
  const [head, ...body] = rows.filter((r) => r.some((x) => x.trim()));
  if (!head) return [];
  const keys = head.map((h) => h.trim().toLowerCase());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

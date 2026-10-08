import { createTmdb } from './tmdb.js';
import { createOpenLibrary } from './openlibrary.js';
import { createMusicBrainz } from './musicbrainz.js';

export function createProviders(opts = {}) {
  return [createTmdb(opts.tmdb), createOpenLibrary(opts.openlibrary), createMusicBrainz(opts.musicbrainz)].filter(Boolean);
}

/** Search every provider that covers `medium`. One provider failing doesn't fail the others. */
export async function searchExternal(providers, query, medium) {
  const relevant = providers.filter((p) => !medium || p.media.includes(medium));
  const settled = await Promise.allSettled(
    relevant.map((p) => withTimeout(p.search(query, medium), 6000))
  );
  const results = [];
  const errors = [];
  settled.forEach((s, i) => {
    if (s.status === 'fulfilled') results.push(...s.value);
    else errors.push({ provider: relevant[i].name, error: s.reason?.message || String(s.reason) });
  });
  return { results, errors };
}

function withTimeout(promise, ms) {
  let t;
  return Promise.race([
    promise,
    new Promise((_, reject) => (t = setTimeout(() => reject(new Error('timed out')), ms))),
  ]).finally(() => clearTimeout(t));
}

// MusicBrainz (https://musicbrainz.org/doc/MusicBrainz_API). No key needed,
// but requests must send a descriptive User-Agent and stay under 1 request/second.
import { normalizeGenres, moodsForGenres } from '../taxonomy.js';

export function createMusicBrainz({ fetchImpl = globalThis.fetch, enabled = process.env.MUSICBRAINZ !== 'off' } = {}) {
  if (!enabled) return null;
  const ua = process.env.MUSICBRAINZ_UA || 'Tastemate/0.1 ( https://github.com/fagand611-dot/media-app )';
  return {
    name: 'musicbrainz',
    media: ['music'],
    async search(query) {
      const url = new URL('https://musicbrainz.org/ws/2/release-group');
      url.searchParams.set('query', query);
      url.searchParams.set('limit', '10');
      url.searchParams.set('fmt', 'json');
      const res = await fetchImpl(url, { headers: { 'User-Agent': ua, accept: 'application/json' } });
      if (!res.ok) throw new Error(`MusicBrainz ${res.status}`);
      const data = await res.json();
      const today = new Date().toISOString().slice(0, 10);
      return (data['release-groups'] || [])
        .filter((rg) => ['Album', 'EP'].includes(rg['primary-type']))
        .map((rg) => {
          const genres = normalizeGenres((rg.tags || []).sort((a, b) => b.count - a.count).map((t) => t.name)).slice(0, 3);
          const date = rg['first-release-date'] || null;
          return {
            medium: 'music',
            title: rg.title,
            year: date ? Number(date.slice(0, 4)) : null,
            creators: (rg['artist-credit'] || []).map((a) => a.name).slice(0, 2),
            genres,
            moods: moodsForGenres(genres),
            description: rg['primary-type'],
            image_url: `https://coverartarchive.org/release-group/${rg.id}/front-250`,
            status: date && date > today ? 'upcoming' : 'released',
            release_date: date,
            source: 'musicbrainz',
            external_id: rg.id,
          };
        });
    },
  };
}

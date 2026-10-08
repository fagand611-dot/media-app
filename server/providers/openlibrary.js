// Open Library (https://openlibrary.org/developers/api). No key needed.
import { normalizeGenres, moodsForGenres } from '../taxonomy.js';

export function createOpenLibrary({ fetchImpl = globalThis.fetch, enabled = process.env.OPENLIBRARY !== 'off' } = {}) {
  if (!enabled) return null;
  return {
    name: 'openlibrary',
    media: ['book'],
    async search(query) {
      const url = new URL('https://openlibrary.org/search.json');
      url.searchParams.set('q', query);
      url.searchParams.set('limit', '10');
      url.searchParams.set('fields', 'key,title,author_name,first_publish_year,subject,cover_i');
      const res = await fetchImpl(url, { headers: { 'User-Agent': 'Tastemate/0.1' } });
      if (!res.ok) throw new Error(`Open Library ${res.status}`);
      const data = await res.json();
      return (data.docs || []).map((d) => {
        const genres = normalizeGenres((d.subject || []).slice(0, 25)).slice(0, 4);
        return {
          medium: 'book',
          title: d.title,
          year: d.first_publish_year ?? null,
          creators: (d.author_name || []).slice(0, 2),
          genres,
          moods: moodsForGenres(genres),
          description: null,
          image_url: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : null,
          status: 'released',
          source: 'openlibrary',
          external_id: d.key,
        };
      });
    },
  };
}

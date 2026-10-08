// The Movie Database (https://developer.themoviedb.org). Needs TMDB_API_KEY,
// which can be a v3 key or a v4 read-access token.
import { normalizeGenres, moodsForGenres } from '../taxonomy.js';

const BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/w342';

// TMDB genre ids → names (stable; listed in their docs).
const GENRE_NAMES = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime', 99: 'Documentary',
  18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music',
  9648: 'Mystery', 10749: 'Romance', 878: 'Science Fiction', 10770: 'TV Movie', 53: 'Thriller',
  10752: 'War', 37: 'Western', 10759: 'Action & Adventure', 10762: 'Kids', 10763: 'News',
  10764: 'Reality', 10765: 'Sci-Fi & Fantasy', 10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics',
};

export function createTmdb({ apiKey = process.env.TMDB_API_KEY, fetchImpl = globalThis.fetch } = {}) {
  if (!apiKey) return null;
  const isBearer = apiKey.length > 40; // v4 tokens are long JWTs

  async function get(path, params = {}) {
    const url = new URL(BASE + path);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    if (!isBearer) url.searchParams.set('api_key', apiKey);
    const res = await fetchImpl(url, {
      headers: isBearer ? { Authorization: `Bearer ${apiKey}`, accept: 'application/json' } : { accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`TMDB ${res.status}`);
    return res.json();
  }

  function toItem(r, medium) {
    const date = medium === 'movie' ? r.release_date : r.first_air_date;
    const genres = normalizeGenres((r.genre_ids || []).map((id) => GENRE_NAMES[id]));
    const today = new Date().toISOString().slice(0, 10);
    return {
      medium,
      title: r.title || r.name,
      year: date ? Number(date.slice(0, 4)) : null,
      creators: [],
      genres,
      moods: moodsForGenres(genres),
      description: r.overview || null,
      image_url: r.poster_path ? IMG + r.poster_path : null,
      status: !date ? 'announced' : date > today ? 'upcoming' : 'released',
      release_date: date || null,
      source: 'tmdb',
      external_id: `${medium}:${r.id}`,
    };
  }

  return {
    name: 'tmdb',
    media: ['movie', 'tv'],
    async search(query, medium) {
      const kinds = medium ? [medium] : ['movie', 'tv'];
      const results = await Promise.all(
        kinds.map((m) => get(`/search/${m}`, { query, include_adult: 'false' }).then((d) => d.results.slice(0, 8).map((r) => toItem(r, m))))
      );
      return results.flat();
    },
    /** Upcoming films plus TV series currently in production. */
    async upcoming() {
      const today = new Date().toISOString().slice(0, 10);
      const [movies, tv] = await Promise.all([
        get('/discover/movie', { 'primary_release_date.gte': today, sort_by: 'popularity.desc' }),
        get('/discover/tv', { 'first_air_date.gte': today, sort_by: 'popularity.desc' }),
      ]);
      return [...movies.results.map((r) => toItem(r, 'movie')), ...tv.results.map((r) => toItem(r, 'tv'))];
    },
  };
}

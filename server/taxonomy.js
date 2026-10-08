// Shared vocabulary for genres and moods.
// Moods apply across media, so a dark thriller, a dark novel and a dark
// album share a tag and can recommend one another.

export const MEDIA = ['movie', 'tv', 'book', 'music'];

export const MOODS = [
  'dark',
  'tense',
  'cerebral',
  'emotional',
  'uplifting',
  'funny',
  'romantic',
  'atmospheric',
  'high-energy',
  'chill',
  'epic',
  'weird',
  'nostalgic',
  'gritty',
];

export const GENRES = {
  movie: ['drama', 'action', 'comedy', 'horror', 'thriller', 'sci-fi', 'fantasy', 'crime', 'romance', 'documentary', 'animation', 'mystery', 'war', 'western'],
  tv: ['drama', 'action', 'comedy', 'horror', 'thriller', 'sci-fi', 'fantasy', 'crime', 'romance', 'documentary', 'animation', 'mystery'],
  book: ['literary fiction', 'sci-fi', 'fantasy', 'horror', 'crime', 'thriller', 'romance', 'non-fiction', 'history', 'biography', 'mystery', 'humour'],
  music: ['house', 'techno', 'electronic', 'rock', 'indie', 'folk', 'pop', 'hip-hop', 'jazz', 'soul', 'metal', 'ambient', 'country', 'classical', 'punk'],
};

// Default moods implied by a genre. Imported items, which come with genres
// but no moods, take their moods from here.
export const GENRE_MOODS = {
  drama: ['emotional'],
  action: ['high-energy', 'epic'],
  comedy: ['funny', 'uplifting'],
  humour: ['funny'],
  horror: ['dark', 'tense'],
  thriller: ['tense'],
  'sci-fi': ['cerebral', 'weird'],
  fantasy: ['epic', 'weird'],
  crime: ['gritty', 'tense'],
  mystery: ['cerebral', 'tense'],
  romance: ['romantic', 'emotional'],
  documentary: ['cerebral'],
  'non-fiction': ['cerebral'],
  history: ['cerebral', 'nostalgic'],
  biography: ['emotional'],
  animation: ['uplifting'],
  war: ['gritty', 'epic'],
  western: ['gritty', 'atmospheric'],
  'literary fiction': ['emotional', 'cerebral'],
  house: ['high-energy', 'uplifting'],
  techno: ['high-energy', 'dark'],
  electronic: ['high-energy', 'atmospheric'],
  rock: ['high-energy'],
  indie: ['nostalgic'],
  folk: ['chill', 'emotional', 'atmospheric'],
  pop: ['uplifting'],
  'hip-hop': ['gritty', 'high-energy'],
  jazz: ['chill', 'cerebral'],
  soul: ['emotional', 'romantic'],
  metal: ['dark', 'high-energy'],
  ambient: ['atmospheric', 'chill'],
  country: ['nostalgic', 'emotional'],
  classical: ['atmospheric', 'epic'],
  punk: ['high-energy', 'gritty'],
};

// Map external provider genre names onto our vocabulary.
const ALIASES = {
  'science fiction': 'sci-fi',
  'sci-fi & fantasy': 'sci-fi',
  'science fiction & fantasy': 'sci-fi',
  'action & adventure': 'action',
  adventure: 'action',
  'war & politics': 'war',
  'tv movie': 'drama',
  family: 'animation',
  kids: 'animation',
  'deep house': 'house',
  'tech house': 'house',
  'progressive house': 'house',
  'alternative rock': 'rock',
  'hard rock': 'rock',
  'classic rock': 'rock',
  'indie rock': 'indie',
  'indie folk': 'folk',
  'folk rock': 'folk',
  'singer-songwriter': 'folk',
  'r&b': 'soul',
  'rap': 'hip-hop',
  'hip hop': 'hip-hop',
  'heavy metal': 'metal',
  'electronica': 'electronic',
  edm: 'electronic',
  dance: 'electronic',
  fiction: 'literary fiction',
  'literary': 'literary fiction',
  'detective and mystery stories': 'mystery',
  'horror tales': 'horror',
  'fantasy fiction': 'fantasy',
  'humor': 'humour',
  'biography & autobiography': 'biography',
  'love stories': 'romance',
  'suspense': 'thriller',
};

const ALL_GENRES = new Set(Object.values(GENRES).flat());

/** Normalise a provider genre string to our vocabulary, or return null. */
export function normalizeGenre(raw) {
  if (!raw) return null;
  const g = String(raw).trim().toLowerCase();
  if (ALL_GENRES.has(g)) return g;
  if (ALIASES[g]) return ALIASES[g];
  for (const known of ALL_GENRES) if (g.includes(known)) return known;
  return null;
}

export function normalizeGenres(list) {
  return [...new Set((list || []).map(normalizeGenre).filter(Boolean))];
}

export function moodsForGenres(genres) {
  return [...new Set(genres.flatMap((g) => GENRE_MOODS[g] || []))];
}

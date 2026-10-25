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

// ----- Taste graph: saves from everywhere -----
// A save is anything you kept in another app: a song, a place, a look, a
// product. Saves share one tag vocabulary with the media above (moods
// included), which is what lets a jazz playlist point at a wine bar.

export const SAVE_KINDS = ['song', 'place', 'look', 'product', 'art', 'food', 'event', 'other'];
export const SAVE_SOURCES = ['spotify', 'instagram', 'google_maps', 'pinterest', 'manual', 'tastemate'];
export const SPOT_KINDS = ['event', 'place', 'product'];

// Keyword → tags. Matched against a save's title, note, collection and
// creator, so "Candlelit wine bar" picks up wine bar, intimate and moody.
// Order doesn't matter; every matching keyword adds its tags.
export const VIBE_KEYWORDS = {
  jazz: ['jazz', 'chill', 'cerebral'],
  'bossa nova': ['jazz', 'chill', 'romantic'],
  blues: ['jazz', 'emotional'],
  soul: ['soul', 'emotional'],
  techno: ['techno', 'high-energy', 'dark'],
  house: ['house', 'high-energy'],
  'deep house': ['house', 'chill'],
  disco: ['house', 'high-energy', 'nostalgic'],
  vinyl: ['vinyl', 'vintage'],
  'record store': ['vinyl', 'vintage'],
  'listening bar': ['vinyl', 'jazz', 'intimate'],
  folk: ['folk', 'chill'],
  acoustic: ['folk', 'intimate'],
  ambient: ['ambient', 'atmospheric'],
  'lo-fi': ['ambient', 'chill'],
  indie: ['indie', 'nostalgic'],
  'stand-up': ['comedy', 'funny'],
  comedy: ['comedy', 'funny'],
  improv: ['comedy', 'funny', 'intimate'],
  gallery: ['art', 'gallery', 'cerebral'],
  museum: ['art', 'gallery', 'cerebral'],
  exhibition: ['art', 'gallery'],
  'contemporary art': ['art', 'contemporary art', 'cerebral'],
  installation: ['art', 'contemporary art', 'weird'],
  ceramics: ['art', 'craft', 'minimal'],
  photography: ['art', 'photography'],
  print: ['art', 'design'],
  design: ['design', 'minimal'],
  architecture: ['design', 'architecture'],
  brutalist: ['architecture', 'minimal', 'dark'],
  pastry: ['pastry', 'food'],
  croissant: ['pastry', 'food'],
  bakery: ['pastry', 'food', 'cozy'],
  patisserie: ['pastry', 'food'],
  viennoiserie: ['pastry', 'food'],
  coffee: ['coffee', 'cozy'],
  cafe: ['coffee', 'cozy'],
  'specialty coffee': ['coffee', 'minimal'],
  matcha: ['coffee', 'minimal'],
  'wine bar': ['wine bar', 'intimate', 'romantic'],
  'natural wine': ['wine bar', 'intimate'],
  wine: ['wine bar'],
  cocktail: ['cocktails', 'intimate'],
  speakeasy: ['cocktails', 'intimate', 'moody'],
  rooftop: ['rooftop', 'lively'],
  candlelit: ['moody', 'intimate', 'romantic'],
  candle: ['moody', 'cozy'],
  moody: ['moody', 'dark', 'atmospheric'],
  'dark academia': ['dark academia', 'moody', 'vintage', 'cerebral'],
  tweed: ['dark academia', 'tailoring', 'vintage'],
  wool: ['tailoring', 'cozy'],
  coat: ['tailoring', 'outerwear'],
  trench: ['tailoring', 'outerwear', 'classic'],
  blazer: ['tailoring', 'classic'],
  tailoring: ['tailoring', 'classic'],
  minimal: ['minimal'],
  minimalist: ['minimal'],
  linen: ['minimal', 'chill'],
  vintage: ['vintage', 'nostalgic'],
  thrift: ['vintage'],
  streetwear: ['streetwear', 'high-energy'],
  sneaker: ['streetwear'],
  gorpcore: ['outdoors', 'streetwear'],
  hiking: ['outdoors', 'uplifting'],
  trail: ['outdoors'],
  park: ['outdoors', 'chill'],
  beach: ['outdoors', 'chill'],
  bookshop: ['books', 'cozy', 'cerebral'],
  bookstore: ['books', 'cozy', 'cerebral'],
  library: ['books', 'cerebral'],
  poetry: ['books', 'intimate', 'emotional'],
  cinema: ['film', 'atmospheric'],
  'film club': ['film', 'cerebral'],
  noodle: ['food', 'street food'],
  'street food': ['food', 'street food', 'lively'],
  market: ['market', 'lively'],
  'night market': ['market', 'street food', 'lively'],
  omakase: ['food', 'intimate', 'luxe'],
  'tasting menu': ['food', 'luxe'],
  ramen: ['food', 'street food'],
  thai: ['food', 'thai'],
  izakaya: ['food', 'intimate', 'lively'],
  rave: ['techno', 'high-energy', 'lively'],
  club: ['lively', 'high-energy'],
  'live music': ['live music', 'lively'],
  gig: ['live music', 'lively'],
  concert: ['live music'],
  festival: ['live music', 'lively', 'epic'],
  sauna: ['wellness', 'chill'],
  spa: ['wellness', 'chill', 'luxe'],
  yoga: ['wellness', 'chill'],
  luxury: ['luxe'],
  cozy: ['cozy'],
  cosy: ['cozy'],
  'hidden gem': ['hidden gem'],
  secret: ['hidden gem', 'intimate'],
};

// Kinds a save is filed under, guessed from its tags when the source can't say.
const KIND_HINTS = [
  ['place', ['wine bar', 'coffee', 'cocktails', 'rooftop', 'gallery', 'bookshop', 'market', 'park']],
  ['food', ['pastry', 'food', 'street food']],
  ['look', ['tailoring', 'outerwear', 'streetwear', 'dark academia']],
  ['art', ['art', 'photography', 'architecture']],
];

const KEYWORD_RES = Object.entries(VIBE_KEYWORDS)
  .sort((a, b) => b[0].length - a[0].length)
  .map(([k, tags]) => [new RegExp(`(^|[^a-z])${k.replace(/[-]/g, '[- ]?')}(s|es)?([^a-z]|$)`, 'i'), tags]);

/** Tags implied by free text (title, note, collection name…). */
export function autoTag(...texts) {
  const s = texts.filter(Boolean).join(' · ');
  const out = new Set();
  if (!s) return [];
  for (const [re, tags] of KEYWORD_RES) if (re.test(s)) tags.forEach((t) => out.add(t));
  // Music genres from the media vocabulary carry their moods across.
  for (const g of normalizeGenres(s.split(/[·,/|]/))) {
    if (GENRES.music.includes(g)) {
      out.add(g);
      moodsForGenres([g]).forEach((m) => out.add(m));
    }
  }
  return [...out];
}

/** Best-guess kind for a save from its tags, or `fallback`. */
export function guessKind(tags, fallback = 'other') {
  for (const [kind, hints] of KIND_HINTS) if (hints.some((h) => tags.includes(h))) return kind;
  return fallback;
}

/** Clean a user-supplied tag list: lower case, trimmed, deduplicated, bounded. */
export function cleanTags(list) {
  return [...new Set((Array.isArray(list) ? list : []).map((t) => String(t).trim().toLowerCase().slice(0, 40)).filter(Boolean))].slice(0, 20);
}

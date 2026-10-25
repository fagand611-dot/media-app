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
  'blue note': ['jazz', 'vinyl'],
  kissa: ['jazz', 'vinyl', 'coffee', 'intimate'],
  coltrane: ['jazz'],
  saxophone: ['jazz'],
  trumpet: ['jazz'],
  'piano trio': ['jazz', 'intimate'],
  'upright bass': ['jazz'],
  smoky: ['moody', 'jazz'],
  records: ['vinyl'],
  turntable: ['vinyl'],
  'hi-fi': ['vinyl', 'jazz'],
  candlelight: ['moody', 'intimate', 'romantic'],
  concrete: ['architecture', 'minimal'],
  lamination: ['pastry'],
  laminated: ['pastry'],
  sourdough: ['food', 'pastry'],
  tea: ['cozy'],
  'string quartet': ['classical', 'intimate'],
  orchestra: ['classical', 'epic'],
};

// Artists whose genre isn't in their song titles. The catalogue fills in
// more at import time; this covers well-known names it may not have.
export const KNOWN_CREATORS = {
  'miles davis': ['jazz'],
  'john coltrane': ['jazz'],
  'bill evans': ['jazz'],
  'duke ellington': ['jazz'],
  'thelonious monk': ['jazz'],
  'chet baker': ['jazz', 'romantic'],
  'dave brubeck': ['jazz'],
  'the dave brubeck quartet': ['jazz'],
  'nina simone': ['jazz', 'soul'],
  'herbie hancock': ['jazz'],
  'kamasi washington': ['jazz', 'epic'],
  'norah jones': ['jazz', 'chill'],
  'nick drake': ['folk'],
  'massive attack': ['electronic', 'moody', 'dark'],
  portishead: ['electronic', 'moody', 'dark'],
  'daft punk': ['house'],
  'rhythim is rhythim': ['techno'],
  'frankie knuckles': ['house'],
  'max richter': ['classical', 'atmospheric'],
};

// Indirect links between tags: things that often go with a taste without
// naming it. A vinyl habit could be jazz; a speakeasy could be too. These
// are "could be" signals, weighted well below what a save says outright.
export const ASSOCIATIONS = {
  vinyl: [['jazz', 0.5], ['soul', 0.4], ['vintage', 0.3]],
  speakeasy: [['jazz', 0.4], ['cocktails', 0.6]],
  cocktails: [['jazz', 0.25]],
  'wine bar': [['jazz', 0.2], ['food', 0.3]],
  moody: [['jazz', 0.2], ['classical', 0.2]],
  intimate: [['jazz', 0.25], ['folk', 0.2]],
  'dark academia': [['books', 0.5], ['classical', 0.35], ['jazz', 0.2]],
  books: [['coffee', 0.3], ['cozy', 0.3]],
  coffee: [['pastry', 0.35]],
  pastry: [['coffee', 0.4]],
  vintage: [['vinyl', 0.3], ['jazz', 0.15]],
  tailoring: [['classic', 0.4], ['dark academia', 0.2]],
  minimal: [['design', 0.3], ['craft', 0.2]],
  architecture: [['design', 0.4], ['art', 0.3]],
  art: [['gallery', 0.4]],
  craft: [['art', 0.3], ['minimal', 0.3]],
  cozy: [['books', 0.2], ['coffee', 0.25]],
  techno: [['lively', 0.4]],
  house: [['lively', 0.4], ['rooftop', 0.25]],
  chill: [['jazz', 0.15], ['ambient', 0.2]],
  cerebral: [['books', 0.2], ['gallery', 0.2]],
  romantic: [['wine bar', 0.3]],
  soul: [['vinyl', 0.3], ['jazz', 0.3]],
  folk: [['intimate', 0.3], ['live music', 0.2]],
  'live music': [['jazz', 0.2]],
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
  .map(([k, tags]) => [new RegExp(`(^|[^a-z])${k.replace(/[-]/g, '[- ]?')}(s|es)?([^a-z]|$)`, 'i'), k, tags]);
// Single words long enough to spot inside a run-together handle.
const HANDLE_WORDS = Object.entries(VIBE_KEYWORDS)
  .filter(([k]) => k.length >= 5 && /^[a-z -]+$/.test(k))
  .map(([k, tags]) => [k.replace(/[ -]/g, ''), tags]);

/**
 * Read a save's text and say what it signals, and how directly:
 *   obvious     the tag's own word is there ("jazz", or a music genre)
 *   translated  something that means it ("listening bar", "Miles Davis",
 *               "@croissantdiaries" → pastry)
 * Returns [{ tag, tier, via }], strongest tier per tag. "Could be" signals
 * come later, from associations and the user's own patterns (taste-graph.js).
 */
export function readSignals({ title, creator, collection, note } = {}) {
  const s = [title, creator, collection, note].filter(Boolean).join(' · ');
  const out = new Map();
  const put = (tag, tier, via) => {
    const prev = out.get(tag);
    if (!prev || (prev.tier === 'translated' && tier === 'obvious')) out.set(tag, { tag, tier, via });
  };
  if (!s) return [];
  for (const [re, k, tags] of KEYWORD_RES) {
    if (!re.test(s)) continue;
    for (const t of tags) put(t, t === k ? 'obvious' : 'translated', k);
  }
  // Handles run words together ("croissantdiaries", "concrete.daily"). Only
  // look inside things that are handles, so "candlelit" isn't read as "candle".
  const handles = (s.toLowerCase().match(/@[a-z0-9._]{3,}|[a-z0-9]+[._][a-z0-9._]+/g) || []).map((h) => h.replace(/^@/, ''));
  if (creator && !/\s/.test(creator)) handles.push(creator.toLowerCase());
  for (const token of new Set(handles)) {
    for (const [k, tags] of HANDLE_WORDS) {
      if (token.includes(k)) for (const t of tags) put(t, 'translated', `“${token}” contains “${k}”`);
    }
  }
  // Genres only from short phrases ("Pink Moon · folk"), never mid-sentence,
  // so "pop-up" or "the house special" don't count as music.
  const phrases = s.toLowerCase().split(/[·,/|\n]/).map((x) => x.trim()).filter((x) => x && x.split(/\s+/).length <= 3);
  for (const g of normalizeGenres(phrases)) {
    if (!GENRES.music.includes(g) || !phrases.some((x) => new RegExp(`(^|[^a-z-])${g}([^a-z-]|$)`).test(x) || x === g)) continue;
    put(g, 'obvious', g);
    for (const m of moodsForGenres([g])) put(m, 'translated', `${g} is ${m}`);
  }
  // "Duke Ellington & John Coltrane" counts for both.
  for (const name of creator ? creator.split(/\s*(?:&|,| and | feat\.? )\s*/i) : []) {
    for (const t of KNOWN_CREATORS[name.toLowerCase()] || []) {
      put(t, 'translated', `${name} → ${t}`);
      for (const m of moodsForGenres([t])) put(m, 'translated', `${t} is ${m}`);
    }
  }
  return [...out.values()];
}

/** Tags implied by free text (title, note, collection name…). */
export function autoTag(title, creator, collection, note) {
  return readSignals({ title, creator, collection, note }).map((x) => x.tag);
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

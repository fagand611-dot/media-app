// Occasion planner: "I'm having people over tonight" → one cohesive theme
// pulled from your taste clusters, with the wine, drinks, food, playlist,
// invitation style and a moodboard of your own saves to match.
//
// Pure functions. The idea lists below are small, hand-written starting
// points; each idea carries tags in the shared vocabulary, so it's scored
// against the theme like everything else. See DESIGN.md §9.
import { cosine } from './recommender.js';

export const OCCASIONS = {
  dinner: { label: 'Dinner party', noun: 'supper', bias: { intimate: 0.5, food: 0.5, 'wine bar': 0.4 }, invite: 'Come for dinner' },
  party: { label: 'House party', noun: 'party', bias: { lively: 0.6, 'high-energy': 0.5, house: 0.3 }, invite: 'Come over, bring friends' },
  date: { label: 'Date night', noun: 'evening', bias: { romantic: 0.6, intimate: 0.6, moody: 0.3 }, invite: 'An evening, just us' },
  birthday: { label: 'Birthday', noun: 'birthday', bias: { lively: 0.4, uplifting: 0.4, pastry: 0.3 }, invite: 'Celebrate with me' },
  brunch: { label: 'Brunch', noun: 'brunch', bias: { coffee: 0.6, pastry: 0.6, chill: 0.3 }, invite: 'Late breakfast at mine' },
};

// How a tag reads in a theme name, and its colours.
const THEME = {
  jazz: ['Jazz', ['#1f2a44', '#c8a24a', '#6b4e2e']],
  moody: ['Candlelit', ['#2a1f1d', '#8c3b2e', '#d9a441']],
  dark: ['After-dark', ['#141414', '#3b3b4f', '#9a7b4f']],
  atmospheric: ['Hazy', ['#3d4a5c', '#8fa3b8', '#e4d8c4']],
  intimate: ['Low-lit', ['#3a2420', '#b5651d', '#f1dcc0']],
  romantic: ['Candlelit', ['#5c1a2b', '#c0626f', '#f3d9d3']],
  vinyl: ['Vinyl', ['#111111', '#d64933', '#efe6d8']],
  vintage: ['Vintage', ['#5b4636', '#a68a64', '#ede0c8']],
  'dark academia': ['Old-library', ['#2e2a24', '#5a4632', '#b89b72']],
  cerebral: ['Slow-burn', ['#2b3a42', '#7b8d8e', '#e0d9c8']],
  chill: ['Slow', ['#43566b', '#9fb4a8', '#f2ead9']],
  cozy: ['Cosy', ['#6b3e26', '#d08c60', '#f5e6d3']],
  minimal: ['Minimal', ['#1c1c1c', '#bdb6a8', '#f4f1ea']],
  pastry: ['Patisserie', ['#f3e2c7', '#c98b4b', '#7a4a2a']],
  coffee: ['Café', ['#3b2a20', '#a47551', '#efe3d3']],
  food: ['Long-table', ['#4a3b2a', '#c2703d', '#f2e4cf']],
  'wine bar': ['Natural-wine', ['#4d1f2b', '#a8505d', '#f0ddd2']],
  art: ['Gallery', ['#f2f0eb', '#1d1d1d', '#d94f30']],
  architecture: ['Concrete', ['#8a8a85', '#3c3c3a', '#e9e6df']],
  craft: ['Hand-thrown', ['#a0826d', '#d9c3a5', '#4f4a45']],
  tailoring: ['Sharp', ['#22252b', '#5c6370', '#d8d2c4']],
  house: ['Disco', ['#2b1b4f', '#e64b8c', '#f7c548']],
  techno: ['Warehouse', ['#0d0d0d', '#5d5d5d', '#39ff88']],
  'high-energy': ['Loud', ['#1b1b3a', '#ff5e5b', '#ffd23f']],
  lively: ['Lively', ['#f25c54', '#f7b267', '#f4f1de']],
  folk: ['Fireside', ['#4b3621', '#8f6a3f', '#e8dcc2']],
  thai: ['Bangkok street-food', ['#c0392b', '#f39c12', '#1e8449']],
  'street food': ['Street-food', ['#d35400', '#f1c40f', '#2c3e50']],
  books: ['Bookish', ['#3e2f23', '#8b6b4a', '#efe6d3']],
};
const FALLBACK = ['Easy', ['#2f3e46', '#84a98c', '#f2efe9']];

// [name, type, tags, note]
export const DRINKS = [
  ['Nebbiolo (Langhe or Barolo)', 'wine', ['moody', 'dark', 'intimate', 'food', 'dark academia'], 'Earthy, rose and tar; built for low light and long tables.'],
  ['Skin-contact orange wine', 'wine', ['wine bar', 'craft', 'cerebral', 'intimate'], 'Textured and a talking point, from small producers.'],
  ['Pét-nat sparkling', 'wine', ['wine bar', 'lively', 'uplifting', 'chill'], 'Cloudy, fizzy and fun; easy with snacks.'],
  ['Cru Beaujolais (Morgon, Fleurie)', 'wine', ['chill', 'food', 'cozy', 'romantic'], 'Light red you can chill; goes with almost anything.'],
  ['Champagne, extra brut', 'wine', ['romantic', 'lively', 'pastry', 'minimal'], 'The celebration bottle; sharp and clean.'],
  ['Sauternes', 'wine', ['pastry', 'romantic', 'vintage'], 'Golden and sweet; made for pastry.'],
  ['Off-dry Riesling', 'wine', ['thai', 'street food', 'food', 'lively'], 'A touch of sweetness tames chilli.'],
  ['Northern Rhône Syrah', 'wine', ['jazz', 'moody', 'dark', 'vinyl'], 'Peppery and smoky, like the room you’re picturing.'],
  ['Grüner Veltliner', 'wine', ['minimal', 'chill', 'food'], 'Crisp and green; minimal in a glass.'],
  ['Tawny port', 'wine', ['dark academia', 'books', 'cozy', 'vintage'], 'Nutty and old-world; for the end of the night.'],
  ['Old Fashioned', 'cocktail', ['jazz', 'moody', 'vintage', 'intimate'], 'Bourbon, bitters, orange peel. Stirred, not fussy.'],
  ['Negroni', 'cocktail', ['moody', 'cerebral', 'food', 'dark academia'], 'Bitter, red and grown-up.'],
  ['Espresso martini', 'cocktail', ['coffee', 'lively', 'high-energy', 'house'], 'Wakes the party up.'],
  ['Japanese whisky highball', 'cocktail', ['minimal', 'chill', 'jazz'], 'Tall, cold and quietly precise.'],
  ['Aperol spritz', 'cocktail', ['lively', 'uplifting', 'rooftop'], 'Sunset orange; impossible to get wrong.'],
  ['Hot toddy with Earl Grey', 'cocktail', ['cozy', 'dark academia', 'books'], 'Whisky, tea, honey and lemon.'],
  ['Mezcal paloma', 'cocktail', ['high-energy', 'street food', 'lively'], 'Smoky grapefruit; good with spice.'],
  ['Thai basil and lime soda', 'zero', ['thai', 'street food', 'chill'], 'Bright and herbal, no alcohol.'],
  ['Cold-brew tonic', 'zero', ['coffee', 'minimal', 'chill'], 'Bitter, fizzy, very adult.'],
  ['Smoked tea with orange', 'zero', ['moody', 'jazz', 'cozy', 'dark academia'], 'Lapsang over ice with a twist.'],
  ['Sparkling elderflower', 'zero', ['romantic', 'uplifting', 'pastry'], 'Floral and light.'],
];

// [name, course, tags, note]
export const FOODS = [
  ['Marinated olives and good bread', 'snack', ['wine bar', 'food', 'chill', 'minimal'], 'Zero effort, always right.'],
  ['Gougères (cheese puffs)', 'snack', ['pastry', 'wine bar', 'romantic'], 'Warm from the oven as people arrive.'],
  ['Anchovy toast with butter', 'snack', ['moody', 'wine bar', 'intimate'], 'Salty and dark; perfect with red.'],
  ['Som tam and grilled skewers', 'snack', ['thai', 'street food', 'lively'], 'Shareable and loud.'],
  ['Crudités with miso dip', 'snack', ['minimal', 'chill', 'craft'], 'Clean and colourful on a stoneware plate.'],
  ['Cheese board with honey and figs', 'snack', ['cozy', 'vintage', 'dark academia', 'romantic'], 'Low effort, looks generous.'],
  ['Slow-braised short rib, polenta', 'main', ['moody', 'cozy', 'food', 'dark academia'], 'Make it in the afternoon, serve it in candlelight.'],
  ['Mushroom and truffle risotto', 'main', ['intimate', 'romantic', 'cerebral'], 'Stirred while you talk.'],
  ['Whole roast fish, herbs and lemon', 'main', ['minimal', 'food', 'chill'], 'One tray to the table.'],
  ['Massaman curry with jasmine rice', 'main', ['thai', 'cozy', 'food'], 'Rich, warm and crowd-pleasing.'],
  ['Late-night pizza from the oven', 'main', ['lively', 'high-energy', 'house'], 'Feeds a party at 1am.'],
  ['Shakshuka for the table', 'main', ['coffee', 'chill', 'food'], 'One pan, lots of bread.'],
  ['Tarte Tatin', 'sweet', ['pastry', 'vintage', 'cozy'], 'Caramel and butter; flip it in front of everyone.'],
  ['Dark chocolate mousse', 'sweet', ['moody', 'dark', 'romantic', 'intimate'], 'Bitter, silky, served in small glasses.'],
  ['Croissants from the bakery you saved', 'sweet', ['pastry', 'coffee'], 'Pick them up that morning.'],
  ['Mango sticky rice', 'sweet', ['thai', 'street food'], 'The best ending to a Thai table.'],
  ['Affogato', 'sweet', ['coffee', 'minimal', 'jazz'], 'Espresso over ice cream. Done.'],
];

const DRESS = [
  [['dark academia'], 'Tweed, knits and something from the library'],
  [['tailoring', 'outerwear'], 'Dark tailoring, sharp coats'],
  [['minimal'], 'Monochrome and clean lines'],
  [['vintage'], 'Something second-hand with a story'],
  [['streetwear'], 'Sneakers welcome'],
  [['romantic'], 'Dress up a little'],
];

/** The theme's tag vector: cluster tags, the occasion's leaning, and a little of your wider taste. */
export function themeVector(cluster, occasion, profile) {
  const v = new Map();
  const add = (k, w) => v.set(k, (v.get(k) || 0) + w);
  (cluster?.tags || []).forEach((t, i) => add(t, i === 0 ? 1.2 : 1));
  for (const [t, w] of Object.entries(occasion.bias)) add(t, w);
  let max = 0;
  for (const [k, w] of profile) if (!k.startsWith('creator:')) max = Math.max(max, w);
  if (max) for (const [k, w] of profile) if (!k.startsWith('creator:') && w > 0) add(k, (0.3 * w) / max);
  return v;
}

function pick(list, vec, n, theme) {
  return list
    .map(([name, kind, tags, note]) => {
      const score = tags.reduce((s, t) => s + (vec.get(t) || 0), 0) / Math.sqrt(tags.length);
      return { name, kind, note, score, because: tags.filter((t) => theme.includes(t)) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map(({ score, ...x }) => x);
}

// Theme words that name a thing rather than describe it; they go last
// ("Slow jazz supper", not "Jazz slow supper").
const NOUNS = new Set(['jazz', 'vinyl', 'house', 'techno', 'pastry', 'coffee', 'art', 'wine bar', 'thai', 'street food', 'books', 'folk', 'food']);

export function themeName(tags, occasion) {
  const picked = [];
  for (const t of tags) {
    const w = (THEME[t] || [])[0];
    if (w && !picked.some((p) => p.w === w)) picked.push({ w, noun: NOUNS.has(t) });
    if (picked.length === 2) break;
  }
  if (!picked.length) picked.push({ w: FALLBACK[0], noun: false });
  picked.sort((a, b) => a.noun - b.noun);
  const words = picked.map((p, i) => (i === 0 || /^Bangkok/.test(p.w) ? p.w : p.w.toLowerCase()));
  words[0] = words[0][0].toUpperCase() + words[0].slice(1);
  return `${words.join(' ')} ${occasion.noun}`;
}

/** Relative luminance of a #rrggbb colour, 0 (black) … 1 (white). */
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function saturation(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  return max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
}

const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

export function palette(tags) {
  const out = [];
  for (const t of tags) for (const c of (THEME[t] || [])[1] || []) if (!out.includes(c)) out.push(c);
  for (const c of FALLBACK[1]) if (out.length < 3 && !out.includes(c)) out.push(c);
  return out.slice(0, 5);
}

/** Invitation style: typography, colours, a motif, wording and a dress note. */
export function inviteStyle(tags, occasion, name, looks) {
  const has = (...t) => t.some((x) => tags.includes(x));
  const type = has('dark academia', 'vintage', 'romantic', 'moody') ? 'serif-italic' : has('minimal', 'architecture', 'design') ? 'sans' : has('house', 'lively', 'high-energy', 'techno') ? 'display' : 'serif';
  const motif = has('vinyl', 'jazz') ? 'record' : has('moody', 'romantic', 'intimate') ? 'candle' : has('minimal', 'architecture') ? 'grid' : has('pastry', 'coffee') ? 'sun' : 'arc';
  const lookTags = new Set(looks.flatMap((s) => s.signals.filter((x) => x.tier !== 'possible').map((x) => x.tag)));
  const dress = DRESS.find(([ts]) => ts.some((t) => lookTags.has(t)))?.[1] || null;
  // Background: the darkest colour of the theme. Text: light paper or ink,
  // whichever reads; accent: the most vivid theme colour that still reads on it.
  const colors = palette(tags);
  const bg = [...colors].sort((a, b) => luminance(a) - luminance(b))[0];
  const ink = contrast(bg, '#f6f1e7') >= contrast(bg, '#1a1a1a') ? '#f6f1e7' : '#1a1a1a';
  const others = colors.filter((c) => c !== bg);
  const accent = others.filter((c) => contrast(bg, c) >= 2.5).sort((a, b) => saturation(b) - saturation(a))[0] || others.sort((a, b) => contrast(bg, b) - contrast(bg, a))[0] || ink;
  return { type, motif, colors: { bg, accent, ink }, headline: name, line: occasion.invite, dress };
}

/** Up to 9 saves that carry the theme, alternating kinds so the board isn't all songs. */
export function moodboard(saves, theme, n = 9) {
  const scored = saves
    .map((s) => ({ s, score: s.signals.filter((x) => theme.includes(x.tag)).reduce((a, x) => a + x.conf, 0) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  const byKind = new Map();
  for (const x of scored) byKind.set(x.s.kind, [...(byKind.get(x.s.kind) || []), x.s]);
  const out = [];
  while (out.length < n && [...byKind.values()].some((l) => l.length)) {
    for (const l of byKind.values()) if (l.length && out.length < n) out.push(l.shift());
  }
  return out.map((s) => ({ id: s.id, title: s.title, kind: s.kind, source: s.source, url: s.url, tags: s.signals.filter((x) => theme.includes(x.tag) && x.tier !== 'possible').map((x) => x.tag) }));
}

/**
 * Plan an occasion.
 * @param {object} ctx
 * @param {string} ctx.type      key of OCCASIONS
 * @param {Array}  ctx.clusters  from findPatterns()
 * @param {number} [ctx.theme]   which cluster to theme on (default: best fit for the occasion)
 * @param {Map}    ctx.profile   from tasteProfile()
 * @param {Array}  ctx.saves     interpreted saves (with signals)
 * @param {Array}  [ctx.music]   catalogue music items, for playlist ideas beyond your saves
 * @param {Array}  [ctx.shop]    spots (products/places) near you, already filtered by city
 */
export function planOccasion({ type, clusters, theme, profile, saves, music = [], shop = [] }) {
  const occasion = OCCASIONS[type] || OCCASIONS.dinner;
  // Default: the cluster that best fits the occasion's leaning.
  const fit = (c) => c.tags.reduce((s, t) => s + (occasion.bias[t] || 0), 0) + c.count * 0.05;
  const order = clusters.map((c, i) => [i, fit(c)]).sort((a, b) => b[1] - a[1]).map(([i]) => i);
  const idx = Number.isInteger(theme) && clusters[theme] ? theme : order[0] ?? null;
  const cluster = idx != null ? clusters[idx] : null;
  const vec = themeVector(cluster, occasion, profile);
  const themeTags = [...vec.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t]) => t);
  const name = themeName(cluster ? cluster.tags : themeTags, occasion);

  const drinks = (kind, n) => pick(DRINKS.filter((d) => d[1] === kind), vec, n, themeTags);
  const food = (course, n) => pick(FOODS.filter((f) => f[1] === course), vec, n, themeTags);

  const songs = saves
    .filter((s) => s.kind === 'song' && s.signals.some((x) => x.tier !== 'possible' && themeTags.includes(x.tag)))
    .slice(0, 10)
    .map((s) => ({ id: s.id, title: s.title, creator: s.creator, url: s.url }));
  const more = music
    .map((item) => ({ item, score: cosine(vec, new Map([...item.genres, ...item.moods].map((t) => [t, 1]))) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ item }) => ({ id: item.id, title: item.title, creator: item.creators[0] || null }));

  const shopping = shop
    .map((spot) => ({ spot, score: cosine(vec, new Map(spot.tags.map((t) => [t, 1]))) }))
    .filter((x) => x.score > 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ spot }) => spot);

  return {
    occasion: { type: OCCASIONS[type] ? type : 'dinner', label: occasion.label },
    occasions: Object.entries(OCCASIONS).map(([k, o]) => ({ type: k, label: o.label })),
    themes: order.map((i) => ({ index: i, name: themeName(clusters[i].tags, occasion), tags: clusters[i].tags })),
    theme: { index: idx, name, tags: themeTags, palette: palette(cluster ? cluster.tags : themeTags), from: cluster ? cluster.count + cluster.maybe : 0 },
    drinks: { wine: drinks('wine', 3), cocktails: drinks('cocktail', 2), zero: drinks('zero', 1) },
    food: { snacks: food('snack', 2), main: food('main', 1), sweet: food('sweet', 1) },
    playlist: { fromSaves: songs, more },
    invite: inviteStyle(themeTags, occasion, name, saves.filter((s) => s.kind === 'look')),
    moodboard: moodboard(saves, themeTags),
    shop: shopping,
  };
}

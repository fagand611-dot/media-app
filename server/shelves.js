// Turns the recommender's scores into a curated home page: one top pick, then
// themed "shelves" that each say why they're there, rather than one long list.
// Pure functions: the route loads the data and this module arranges it.
import { cosine, itemFeatures, topTags } from './recommender.js';

// Film and TV count as one "screen" medium here, so the crossover row reaches further.
const SCREEN = new Set(['movie', 'tv']);
const OTHER_MEDIA = { movie: 'books and music', tv: 'books and music', book: 'film, TV and music', music: 'film, TV and books' };
const BEYOND = { movie: 'the screen', tv: 'the screen', book: 'the page', music: 'the music' };

const sameKind = (a, b) => a === b || (SCREEN.has(a) && SCREEN.has(b));
const moodFeatures = (item) => new Map(item.moods.map((m) => [m, 1]));

/** Day number, used to rotate which anchors and moods we feature. */
const dayNumber = (d) => Math.floor(d.getTime() / 864e5);

/**
 * @param {object} ctx
 * @param {Map}    ctx.profile
 * @param {Array}  ctx.library     the user's entries { item, state, score }
 * @param {Array}  ctx.scored      recommend() output for every candidate, best first
 * @param {Array}  ctx.circle      friends' recent high ratings: { item, friend: {name, username}, score, review, at }
 * @param {Array}  ctx.upcoming    [{ item, match }] unreleased items, not dismissed
 * @param {Array}  ctx.friendLists [{ id, title, owner_name, owner_username, unseen, count, covers }]
 * @param {boolean}ctx.hasFriends
 * @param {number} ctx.userId
 * @param {Date}   [ctx.now]
 */
export function buildHome({ profile, library, scored, circle = [], upcoming = [], friendLists = [], hasFriends, userId = 0, now = new Date() }) {
  const used = new Set();
  const take = (entries, n) => {
    const out = [];
    for (const e of entries) {
      if (out.length >= n) break;
      if (used.has(e.item.id)) continue;
      used.add(e.item.id);
      out.push(e);
    }
    return out;
  };
  const shelves = [];
  const push = (shelf, min = 3) => {
    if (shelf.items.length >= min) shelves.push(shelf);
    else shelf.items.forEach((e) => used.delete(e.item.id)); // give them back to later shelves
  };
  const seed = dayNumber(now) + userId;
  const year = now.getFullYear();
  const byId = new Map(scored.map((s) => [s.item.id, s]));

  // New in your circle: what friends have recently rated highly that you haven't
  // logged. Filled first so these picks are never taken by the top pick or other
  // rows, but shown after the top pick.
  if (hasFriends) {
    const grouped = new Map();
    for (const c of circle) {
      if (!grouped.has(c.item.id)) grouped.set(c.item.id, { item: c.item, by: [], at: c.at });
      const g = grouped.get(c.item.id);
      g.by.push({ name: c.friend.name, username: c.friend.username, score: c.score, review: c.review, at: c.at });
      if (c.at > g.at) g.at = c.at;
    }
    const entries = [...grouped.values()]
      .map((g) => ({ ...g, match: byId.get(g.item.id)?.match ?? null, by: g.by.sort((a, b) => b.at.localeCompare(a.at)) }))
      .sort((a, b) => b.at.localeCompare(a.at) || b.by.length - a.by.length);
    push({ id: 'circle', kind: 'circle', title: 'New in your circle', subtitle: 'Picks your friends have recently rated highly that you haven’t tried yet.', items: take(entries, ROW) }, 1);
  } else {
    shelves.push({ id: 'circle', kind: 'cta', title: 'New in your circle', subtitle: 'When friends rate something highly, it shows up here.', message: 'You haven’t added any friends yet.', action: { label: 'Find friends', to: '/friends' }, items: [] });
  }

  // Top pick: the best overall match not already in the circle row.
  const [hero] = take(scored, 1);

  // Because you loved X: the titles closest to one of your favourites, in the same
  // kind of medium (the crossover row below covers the others).
  const loved = library.filter((e) => e.score >= 8).sort((a, b) => b.score - a.score || (b.updated_at || '').localeCompare(a.updated_at || ''));
  const anchors = loved.slice(0, 6);
  // `features` picks what "similar" means: every feature, or just moods for
  // cross-medium matches (genres rarely line up between, say, a film and an album).
  const similarTo = (anchor, { filter = () => true, features = itemFeatures } = {}) => {
    const af = features(anchor);
    return scored
      .filter((s) => filter(s.item))
      .map((s) => ({ s, sim: cosine(af, features(s.item)) }))
      .filter((x) => x.sim > 0.2)
      .sort((a, b) => 0.7 * b.sim + 0.3 * b.s.score - (0.7 * a.sim + 0.3 * a.s.score))
      .map(({ s, sim }) => ({ item: s.item, match: s.match, note: sharedLabel(anchor, s.item) || `${Math.round(sim * 100)}% similar` }));
  };
  if (anchors.length) {
    const a1 = anchors[seed % anchors.length].item;
    push({ id: 'because', kind: 'items', title: `Because you loved ${a1.title}`, subtitle: 'Closest in mood, genre and style to one of your favourites.', anchor: slim(a1), items: take(similarTo(a1, { filter: (i) => sameKind(i.medium, a1.medium) }), ROW) });

    // Beyond the medium: the same feel as another favourite, in a different medium.
    const a2 = anchors.length > 1 ? anchors[(seed + 1) % anchors.length].item : a1;
    push({
      id: 'crossover',
      kind: 'items',
      title: `The feel of ${a2.title}, beyond ${BEYOND[a2.medium]}`,
      subtitle: `${cap(OTHER_MEDIA[a2.medium])} that share its mood.`,
      anchor: slim(a2),
      items: take(similarTo(a2, { filter: (i) => !sameKind(i.medium, a2.medium), features: moodFeatures }), ROW),
    });
  }

  // Mood of the day: rotate through your strongest moods.
  const moods = topTags(profile, 20).likes.filter((t) => t.kind === 'mood').slice(0, 3);
  if (moods.length) {
    const mood = moods[seed % moods.length].label;
    const entries = scored.filter((s) => s.item.moods.includes(mood)).map((s) => ({ item: s.item, match: s.match, note: noteFor(s) }));
    push({ id: 'mood', kind: 'items', title: `In ${/^[aeiou]/.test(mood) ? 'an' : 'a'} ${mood} mood`, subtitle: `One of the moods you return to most, across everything.`, items: take(entries, ROW) });
  }

  // Coming soon: upcoming work that matches your taste.
  const soon = upcoming
    .filter((u) => u.match >= 30)
    .map((u) => ({ item: u.item, match: u.match, note: [STATUS[u.item.status], u.item.release_date].filter(Boolean).join(' · '), watching: u.watching }));
  push({ id: 'soon', kind: 'items', title: 'Coming soon for you', subtitle: 'In production or announced, ranked by your taste. Watch them to get them on your radar.', more: '/radar', items: take(soon, ROW) }, 2);

  // Classics you haven't got to.
  const classics = scored.filter((s) => s.match >= MIN_MATCH && s.item.year && s.item.year <= year - 30).map((s) => ({ item: s.item, match: s.match, note: `${s.item.year} · ${noteFor(s)}` }));
  push({ id: 'classics', kind: 'items', title: 'Classics you haven’t got to', subtitle: 'Older work that fits your taste. Good things don’t expire.', items: take(classics, ROW) });

  // Recent releases.
  const recent = scored.filter((s) => s.match >= MIN_MATCH && s.item.year && s.item.year >= year - 4).map((s) => ({ item: s.item, match: s.match, note: `${s.item.year} · ${noteFor(s)}` }));
  push({ id: 'recent', kind: 'items', title: 'Recent releases you might have missed', subtitle: 'From the last few years.', items: take(recent, ROW) });

  // Friends' lists that still have things in them for you.
  const lists = friendLists.filter((l) => l.unseen > 0).sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 6);
  if (lists.length) shelves.push({ id: 'lists', kind: 'lists', title: 'Fresh from your friends’ lists', subtitle: 'Collections with titles you haven’t tried.', lists });

  // Something different: well-loved work outside your usual tags.
  const different = scored
    .filter((s) => s.parts.content < 0.2 && (s.parts.social > 0.05 || s.parts.quality > 0.62))
    .sort((a, b) => b.parts.social + b.parts.quality - (a.parts.social + a.parts.quality))
    .map((s) => ({ item: s.item, match: null, note: friendNote(s) || 'Highly rated, outside your usual' }));
  push({ id: 'different', kind: 'items', title: 'Something different', subtitle: 'Outside your comfort zone, but other people rate it highly.', items: take(different, ROW) });

  return {
    hero: hero ? { item: hero.item, match: hero.match, reasons: hero.reasons } : null,
    shelves,
  };
}

/** Items per shelf: enough to scroll, few enough that later shelves still get the good stuff. */
const ROW = 8;
/** Weakest % match allowed on the era shelves, so they don't pad with poor fits. */
const MIN_MATCH = 30;
const STATUS = { upcoming: 'Upcoming', in_production: 'In production', announced: 'Announced' };
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const slim = (i) => ({ id: i.id, title: i.title, medium: i.medium });

function friendNote(s) {
  const f = s.reasons.find((r) => r.type === 'friend');
  return f ? `${f.name} rated it ${f.score}/10` : null;
}

function noteFor(s) {
  return friendNote(s) || `${s.match}% match`;
}

/** "dark, tense" — the moods/genres two items share, for a one-line reason. */
function sharedLabel(a, b) {
  const tags = [...a.moods.filter((m) => b.moods.includes(m)), ...a.genres.filter((g) => b.genres.includes(g))];
  const creators = a.creators.filter((c) => b.creators.includes(c));
  if (creators.length) return `Also ${creators[0]}`;
  return tags.slice(0, 3).join(', ');
}

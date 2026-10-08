// Explainable hybrid recommender. These are pure functions: the route layer
// loads rows, and the scoring and ranking here don't touch the database,
// which keeps them easy to test and to replace later.
//
// See DESIGN.md §4 for the scoring model.

export const FEATURE_WEIGHTS = { genre: 1.0, mood: 1.2, creator: 1.5, era: 0.3, medium: 0.2 };
export const SIGNAL = { want: 0.35, dismissed: -0.6, in_progress: 0.2 };
export const BLEND = { content: 0.6, social: 0.25, quality: 0.15 };

/**
 * Similarity 0..1 → a "% match" for display. Cosine values on sparse tag
 * vectors rarely go above 0.6, so a square-root curve makes them easier to read.
 */
export const toPercent = (x) => Math.round(Math.sqrt(Math.max(0, Math.min(1, x))) * 100);

/** Rating 1..10 → -1..+1 (5.5 is neutral). */
export const normScore = (s) => (s - 5.5) / 4.5;

/** Sparse feature vector for an item: Map<feature, weight>. */
export function itemFeatures(item) {
  const f = new Map();
  const add = (k, w) => f.set(k, (f.get(k) || 0) + w);
  for (const g of item.genres || []) add(`genre:${g}`, FEATURE_WEIGHTS.genre);
  for (const m of item.moods || []) add(`mood:${m}`, FEATURE_WEIGHTS.mood);
  for (const c of item.creators || []) add(`creator:${c.toLowerCase()}`, FEATURE_WEIGHTS.creator);
  if (item.year) add(`era:${Math.floor(item.year / 10) * 10}s`, FEATURE_WEIGHTS.era);
  if (item.medium) add(`medium:${item.medium}`, FEATURE_WEIGHTS.medium);
  return f;
}

function norm(v) {
  let s = 0;
  for (const x of v.values()) s += x * x;
  return Math.sqrt(s);
}

export function cosine(a, b) {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return 0;
  const [small, big] = a.size < b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [k, x] of small) {
    const y = big.get(k);
    if (y) dot += x * y;
  }
  return dot / (na * nb);
}

/** The signed weight a library entry contributes to the profile. */
export function entrySignal(entry) {
  if (entry.score != null) return normScore(entry.score);
  return SIGNAL[entry.state] ?? 0;
}

/**
 * Build a taste profile.
 * @param entries  library rows: { item, state, score }
 * @param tagPrefs rows: { tag, weight } where tag looks like "genre:horror" or "mood:dark"
 */
export function buildProfile(entries, tagPrefs = []) {
  const p = new Map();
  for (const e of entries) {
    const w = entrySignal(e);
    if (!w) continue;
    const f = itemFeatures(e.item);
    // Normalise by vector length so heavily tagged items don't dominate.
    const n = norm(f) || 1;
    for (const [k, x] of f) p.set(k, (p.get(k) || 0) + (w * x) / n);
  }
  for (const { tag, weight } of tagPrefs) p.set(tag, (p.get(tag) || 0) + weight);
  return p;
}

/** Similarity between two users' profiles, 0..1 (negatives clipped). */
export function tasteSimilarity(p1, p2) {
  return Math.max(0, cosine(p1, p2));
}

/** Top positive and negative profile features, for the "Taste DNA" view. */
export function topTags(profile, n = 12) {
  const all = [...profile.entries()].filter(([k]) => !k.startsWith('medium:'));
  const pos = all.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, n);
  const neg = all.filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]).slice(0, Math.ceil(n / 2));
  const fmt = ([k, v]) => {
    const [kind, ...rest] = k.split(':');
    return { tag: k, kind, label: rest.join(':'), weight: +v.toFixed(3) };
  };
  return { likes: pos.map(fmt), dislikes: neg.map(fmt) };
}

/** Bayesian-average quality prior from community scores, 0..1. */
export function qualityPrior(scores, { prior = 6.5, strength = 3 } = {}) {
  const n = scores.length;
  const sum = scores.reduce((a, b) => a + b, 0);
  const avg = (prior * strength + sum) / (strength + n);
  return (avg - 1) / 9;
}

/** Display label for a feature key, using the item's original creator capitalisation. */
function featureLabel(k, item) {
  const label = k.split(':').slice(1).join(':');
  if (k.startsWith('creator:') && item) return item.creators.find((c) => c.toLowerCase() === label) || label;
  return label;
}

/**
 * Rank candidate items for a user.
 *
 * @param {object} ctx
 * @param {Map}    ctx.profile         the user's profile
 * @param {Array}  ctx.library         the user's entries { item, state, score }, used for reasons
 * @param {Array}  ctx.candidates      items to rank (exclude ones already in the library)
 * @param {Array}  ctx.friends         [{ id, name, profile }]
 * @param {Map}    ctx.friendScores    item_id → [{ friendId, score }]
 * @param {Map}    ctx.communityScores item_id → [score, ...]
 * @param {number} [ctx.limit=20]
 * @param {boolean}[ctx.diversify=true]
 */
export function recommend({
  profile,
  library = [],
  candidates,
  friends = [],
  friendScores = new Map(),
  communityScores = new Map(),
  limit = 20,
  diversify = true,
}) {
  const friendSim = new Map(friends.map((f) => [f.id, { name: f.name, sim: tasteSimilarity(profile, f.profile) }]));
  const loved = library
    .filter((e) => e.score != null && e.score >= 8)
    .sort((a, b) => b.score - a.score)
    .map((e) => ({ item: e.item, f: itemFeatures(e.item) }));

  const scored = candidates.map((item) => {
    const f = itemFeatures(item);
    const content = cosine(profile, f);

    let socialRaw = 0;
    const friendReasons = [];
    for (const { friendId, score } of friendScores.get(item.id) || []) {
      const fs = friendSim.get(friendId);
      if (!fs) continue;
      // Even a friend whose taste differs a lot from yours counts for a little.
      socialRaw += Math.max(0.15, fs.sim) * normScore(score);
      if (score >= 7) friendReasons.push({ type: 'friend', name: fs.name, score });
    }
    const social = Math.tanh(socialRaw);
    const quality = qualityPrior(communityScores.get(item.id) || []);
    const score = BLEND.content * content + BLEND.social * social + BLEND.quality * quality;

    return { item, f, score, parts: { content, social, quality }, friendReasons };
  });

  scored.sort((a, b) => b.score - a.score);
  const picked = diversify ? mmr(scored, limit) : scored.slice(0, limit);
  return picked.map((s) => ({
    item: s.item,
    score: +s.score.toFixed(4),
    match: toPercent(s.parts.content),
    parts: Object.fromEntries(Object.entries(s.parts).map(([k, v]) => [k, +v.toFixed(4)])),
    reasons: explain(s, profile, loved),
  }));
}

/** Maximal-marginal-relevance re-rank: trade relevance against redundancy. */
function mmr(scored, limit, lambda = 0.7) {
  const pool = scored.slice(0, Math.max(limit * 4, 40));
  const out = [];
  const seenMedia = new Set();
  while (out.length < limit && pool.length) {
    let bestI = 0;
    let best = -Infinity;
    for (let i = 0; i < pool.length; i++) {
      const c = pool[i];
      let maxSim = 0;
      for (const p of out) maxSim = Math.max(maxSim, cosine(c.f, p.f));
      const novelty = seenMedia.has(c.item.medium) ? 0 : 0.06;
      const v = lambda * c.score - (1 - lambda) * maxSim + novelty;
      if (v > best) {
        best = v;
        bestI = i;
      }
    }
    const [chosen] = pool.splice(bestI, 1);
    seenMedia.add(chosen.item.medium);
    out.push(chosen);
  }
  return out;
}

/** Turn the strongest overlapping features into readable reasons. */
function explain(s, profile, loved) {
  const reasons = [];
  // Feature contributions: profile weight × item weight.
  const contrib = [];
  for (const [k, x] of s.f) {
    if (k.startsWith('medium:') || k.startsWith('era:')) continue;
    const p = profile.get(k) || 0;
    if (p > 0) contrib.push([k, p * x]);
  }
  contrib.sort((a, b) => b[1] - a[1]);
  const topFeatures = contrib.slice(0, 3).map(([k]) => k);

  // "Because you loved X": the loved item sharing the most top features.
  let bestLoved = null;
  let bestOverlap = 0;
  for (const l of loved) {
    if (l.item.id === s.item.id) continue;
    let overlap = 0;
    for (const k of topFeatures) if (l.f.has(k)) overlap += k.startsWith('creator:') ? 2 : 1;
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestLoved = l.item;
    }
  }
  if (bestLoved) {
    const shared = topFeatures.filter((k) => itemFeatures(bestLoved).has(k)).map((k) => featureLabel(k, s.item));
    reasons.push({ type: 'because', itemId: bestLoved.id, title: bestLoved.title, medium: bestLoved.medium, tags: shared });
  } else if (topFeatures.length) {
    reasons.push({ type: 'tags', tags: topFeatures.map((k) => featureLabel(k, s.item)) });
  }
  reasons.push(...s.friendReasons.sort((a, b) => b.score - a.score).slice(0, 3));
  return reasons;
}

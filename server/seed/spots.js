// Sample spots (events, places, products) and sample saves for the demo
// accounts. Real deployments would fill spots from event and venue feeds
// (DESIGN.md §9); these exist so Next works out of the box.
//
// Events: [title, city, venue, tags, startOffsetDays, lengthDays, popularity, description, creators?]
// Places: [title, city, venue, tags, openedDaysAgo | null, popularity, description]
// Products: [title, city | null, store, tags, price, popularity, description]

export const SPOT_CITIES = ['Bangkok', 'London', 'Dublin', 'Tokyo'];

export const EVENTS = [
  ['Late-night jazz at a listening bar', 'Bangkok', 'Studio Lam', ['jazz', 'vinyl', 'intimate', 'chill', 'moody'], 1, 1, 0.25, 'Original pressings, a small room and a sound system built for it.'],
  ['Contemporary Thai artists: group show', 'Bangkok', 'Bangkok Art and Culture Centre', ['art', 'contemporary art', 'gallery', 'cerebral'], -5, 40, 0.55, 'Twelve artists working in installation, photography and textiles.'],
  ['Night market and street food crawl', 'Bangkok', 'Jodd Fairs', ['market', 'street food', 'food', 'lively', 'thai'], 2, 1, 0.8, 'A guided walk through the stalls, with a local food writer.'],
  ['Ceramics studio open day', 'Bangkok', 'Charoenkrung Craft House', ['art', 'craft', 'minimal', 'hidden gem'], 3, 2, 0.12, 'Throw a bowl, meet the potters, buy straight from the kiln.'],
  ['Deep house rooftop session', 'Bangkok', 'Octave Rooftop', ['house', 'rooftop', 'high-energy', 'lively'], 4, 1, 0.6, 'Sunset to late. Local selectors.'],
  ['Comedy and jazz night', 'Dublin', 'The Workman’s Club', ['comedy', 'funny', 'jazz', 'intimate', 'live music'], 6, 1, 0.3, 'Stand-up sets between trio sets. Small room, bring a friend.'],
  ['Irish folk session, upstairs', 'Dublin', 'The Cobblestone', ['folk', 'live music', 'intimate', 'emotional'], 1, 1, 0.45, 'An open session; no stage, just a circle of players.'],
  ['Photography after dark: exhibition', 'Dublin', 'Gallery of Photography', ['art', 'photography', 'gallery', 'moody', 'dark'], -10, 30, 0.35, 'Night photography from the city, 1950s to now.'],
  ['Candlelit string quartet', 'London', 'St Martin-in-the-Fields', ['classical', 'moody', 'intimate', 'romantic', 'atmospheric'], 5, 1, 0.7, 'Film scores and Vivaldi by candlelight.'],
  ['Brutalist architecture walking tour', 'London', 'Barbican Centre', ['architecture', 'design', 'minimal', 'dark'], 2, 1, 0.3, 'Two hours through the estate, the conservatory and the towers.'],
  ['Natural wine and vinyl evening', 'London', 'Brawn', ['wine bar', 'vinyl', 'intimate', 'jazz'], 3, 1, 0.2, 'A winemaker pours; a DJ plays records only.'],
  ['Dark academia book club: The Secret History', 'London', 'Daunt Books Marylebone', ['books', 'dark academia', 'cerebral', 'cozy', 'moody'], 8, 1, 0.15, 'Discussion, tea and a reading from a new campus novel.'],
  ['Techno all-nighter', 'London', 'Fabric', ['techno', 'high-energy', 'dark', 'lively'], 6, 1, 0.75, 'Three rooms, eight hours.'],
  ['Kissa jazz evening', 'Tokyo', 'JBS Shibuya', ['jazz', 'vinyl', 'intimate', 'chill'], 2, 1, 0.3, 'A wall of records and an owner who takes requests.'],
];

export const PLACES = [
  ['Kissa-style listening café', 'Bangkok', 'Ari', ['coffee', 'vinyl', 'jazz', 'cozy', 'intimate'], 21, 0.18, 'Hand-drip coffee by day, records at night.'],
  ['Laminated: a croissant bakery', 'Bangkok', 'Thonglor', ['pastry', 'food', 'coffee'], 14, 0.4, 'Croissants laminated over three days. Sells out by noon.'],
  ['Speakeasy behind a noodle shop', 'Bangkok', 'Chinatown', ['cocktails', 'speakeasy', 'intimate', 'moody', 'hidden gem'], null, 0.22, 'Order the house noodle, then ask for the back room.'],
  ['Riverside contemporary gallery', 'Bangkok', 'Charoenkrung', ['art', 'gallery', 'contemporary art', 'minimal'], null, 0.3, 'A converted warehouse on the river.'],
  ['Brutalist bookshop and café', 'Bangkok', 'Silom', ['books', 'coffee', 'architecture', 'minimal', 'cerebral'], null, 0.25, 'Concrete shelves, design books, very good iced latte.'],
  ['New pastry counter by a Parisian chef', 'London', 'Shoreditch', ['pastry', 'food', 'viennoiserie', 'minimal'], 9, 0.35, 'Just opened. Pistachio cruffins and a short coffee menu.'],
  ['Candlelit wine bar in a railway arch', 'London', 'Bermondsey', ['wine bar', 'intimate', 'moody', 'romantic'], null, 0.4, 'Low arches, natural wine, small plates.'],
  ['Members-free jazz basement', 'London', 'Soho', ['jazz', 'live music', 'intimate', 'moody'], null, 0.55, 'Walk-ins after 10pm.'],
  ['Specialty coffee and records', 'Dublin', 'Stoneybatter', ['coffee', 'vinyl', 'cozy'], 30, 0.2, 'Second-hand jazz and soul by the till.'],
  ['Pastry and natural wine bistro', 'Dublin', 'Portobello', ['pastry', 'wine bar', 'food', 'intimate'], null, 0.3, 'Bakery in the morning, wine bar at night.'],
];

export const PRODUCTS = [
  ['Charcoal wool overcoat, relaxed cut', 'Dublin', 'Arnotts, Henry Street', ['tailoring', 'outerwear', 'minimal', 'classic', 'dark academia'], '€240 (was €320)', 0.5, 'In store now, sizes S–XL.'],
  ['Tweed blazer, vintage', 'London', 'Rokit, Covent Garden', ['dark academia', 'tailoring', 'vintage'], '£68', 0.3, 'Hand-picked vintage; one of each.'],
  ['Linen camp shirt', 'Bangkok', 'Siam Discovery', ['minimal', 'linen', 'chill'], '฿1,490', 0.4, 'Breathable and very Bangkok.'],
  ['Stoneware pour-over set', null, 'Ships worldwide', ['coffee', 'craft', 'minimal'], '$58', 0.25, 'Made by a small studio; ships to Ireland, UK, Thailand.'],
  ['Blue Note reissue on 180g vinyl', null, 'Ships worldwide', ['jazz', 'vinyl'], '$34', 0.45, 'The Tone Poet series, mastered from the original tapes.'],
  ['Long wool trench in camel', null, 'Ships to Ireland and UK', ['tailoring', 'outerwear', 'classic', 'minimal'], '€190', 0.55, 'Free returns within 30 days.'],
];

/** Spot rows with dates relative to `now`. */
export function demoSpots(now = new Date()) {
  const day = (offset) => new Date(now.getTime() + offset * 864e5).toISOString().slice(0, 10);
  const rows = [];
  for (const [title, city, venue, tags, start, len, popularity, description, creators] of EVENTS) {
    rows.push({ kind: 'event', title, city, venue, tags, creators, starts_at: day(start), ends_at: len > 1 ? day(start + len - 1) : null, popularity, description });
  }
  for (const [title, city, venue, tags, openedAgo, popularity, description] of PLACES) {
    rows.push({ kind: 'place', title, city, venue, tags, opened_at: openedAgo != null ? day(-openedAgo) : null, popularity, description });
  }
  for (const [title, city, venue, tags, price, popularity, description] of PRODUCTS) {
    rows.push({ kind: 'product', title, city, venue, tags, price, popularity, description });
  }
  return rows.map((r) => ({ ...r, source: 'seed', external_id: `${r.kind}:${r.title}`, is_demo: true }));
}

// Saves for the demo account, across four apps: [source, kind, title, creator, collection, city]
export const DEMO_SAVES = [
  ['spotify', 'song', 'So What', 'Miles Davis', 'Kind of Blue · jazz'],
  ['spotify', 'song', 'In a Sentimental Mood', 'Duke Ellington & John Coltrane', 'late night jazz'],
  ['spotify', 'song', 'Blue in Green', 'Bill Evans', 'jazz'],
  ['spotify', 'song', 'Take Five', 'The Dave Brubeck Quartet', 'jazz'],
  ['spotify', 'song', 'Pink Moon', 'Nick Drake', 'folk'],
  ['spotify', 'song', 'Teardrop', 'Massive Attack', 'moody · electronic'],
  ['spotify', 'song', 'Strings of Life', 'Rhythim Is Rhythim', 'house'],
  ['instagram', 'look', '@thecharcoalcoat', 'thecharcoalcoat', 'Coats'],
  ['instagram', 'look', '@oldlibraryfits', 'oldlibraryfits', 'Dark academia'],
  ['instagram', 'look', '@tweedandtea', 'tweedandtea', 'Dark academia'],
  ['instagram', 'food', '@laminationlab', 'laminationlab', 'Pastry'],
  ['instagram', 'food', '@croissantdiaries', 'croissantdiaries', 'Pastry'],
  ['instagram', 'art', '@quietceramics', 'quietceramics', 'Ceramics'],
  ['instagram', 'art', '@concrete.daily', 'concrete.daily', 'Brutalist architecture'],
  ['google_maps', 'place', 'Candlelit wine bar near the canal', null, 'Want to go', 'Dublin'],
  ['google_maps', 'place', 'Vinyl listening bar', null, 'Loved', 'Tokyo'],
  ['google_maps', 'place', 'Jazz café with a record wall', null, 'Bangkok trip', 'Bangkok'],
  ['google_maps', 'place', 'Specialty coffee, Ari', null, 'Bangkok trip', 'Bangkok'],
  ['google_maps', 'place', 'Bookshop café', null, 'Loved', 'London'],
  ['pinterest', 'look', 'Minimal wool coat outfit', null, 'Winter'],
  ['pinterest', 'art', 'Candle-lit reading nook, moody', null, 'Home'],
];

// Spots demo friends have saved, so Next can say "Maya saved it".
export const FRIEND_SPOT_SAVES = {
  maya: ['Photography after dark: exhibition', 'Kissa-style listening café', 'Dark academia book club: The Secret History', 'Candlelit wine bar in a railway arch'],
  sam: ['Deep house rooftop session', 'Techno all-nighter', 'Laminated: a croissant bakery'],
  jo: ['Comedy and jazz night', 'New pastry counter by a Parisian chef'],
};

// Follow venues' public Instagram accounts and turn their event posts into
// spots. Uses the Instagram Graph API's Business Discovery, which lets an
// Instagram business account read other business and creator accounts'
// public posts. Venues are nearly always business accounts. It needs a Meta
// app with the instagram_basic permission and your own IG business account ID.
// (Facebook Pages work the same way via Page Public Content Access, which
// needs Meta's app review.) Scraping pages instead breaks Meta's terms.
//
// Env: IG_USER_ID, IG_ACCESS_TOKEN, VENUE_ACCOUNTS="Dublin:workmansclub,Bangkok:studiolam"

const GRAPH = 'https://graph.facebook.com/v21.0';

export function parseVenueAccounts(spec) {
  return String(spec || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => {
      const [city, username] = x.includes(':') ? x.split(':') : [null, x];
      return { city: city?.trim() || null, username: username.trim().replace(/^@/, '') };
    })
    .filter((v) => /^[\w.]{1,30}$/.test(v.username));
}

export function createVenuePosts({
  igUserId = process.env.IG_USER_ID,
  accessToken = process.env.IG_ACCESS_TOKEN,
  venues = parseVenueAccounts(process.env.VENUE_ACCOUNTS),
  fetchImpl = fetch,
} = {}) {
  if (!igUserId || !accessToken || !venues.length) return null;
  return {
    name: 'Instagram venues',
    venues,
    /** Recent captions from every followed venue: [{ text, url, posted_at, account, city }]. */
    async fetchPosts() {
      const out = [];
      const errors = [];
      for (const v of venues) {
        const fields = `business_discovery.username(${v.username}){username,name,media.limit(25){caption,permalink,timestamp}}`;
        const url = `${GRAPH}/${encodeURIComponent(igUserId)}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(accessToken)}`;
        try {
          const res = await fetchImpl(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const bd = (await res.json()).business_discovery || {};
          for (const m of bd.media?.data || []) {
            if (m.caption) out.push({ text: m.caption, url: m.permalink, posted_at: m.timestamp, account: v.username, venue: bd.name || null, city: v.city });
          }
        } catch (e) {
          errors.push({ account: v.username, error: e.message });
        }
      }
      return { posts: out, errors };
    },
  };
}

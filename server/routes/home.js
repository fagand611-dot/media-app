import { requireUser } from '../auth.js';
import { hydrateItem } from '../db.js';
import { buildProfile, cosine, itemFeatures, recommend, toPercent } from '../recommender.js';
import { buildHome } from '../shelves.js';
import { communityScores, friendScoresMap, friendsWithProfiles, getLibrary, getTagPrefs } from '../services.js';

const CIRCLE_MIN_SCORE = 7;

export default function homeRoutes(r, { db }) {
  // The curated "For You" page: a top pick plus themed shelves.
  r.get('/home', requireUser, (req, res) => {
    const me = req.user.id;
    const library = getLibrary(db, me);
    const profile = buildProfile(library, getTagPrefs(db, me));
    const mine = new Map(library.map((e) => [e.item.id, e.state]));

    const all = db.prepare('SELECT * FROM items').all().map(hydrateItem);
    const candidates = all.filter((i) => i.status === 'released' && !mine.has(i.id));
    const friends = friendsWithProfiles(db, me, profile);
    const fids = friends.map((f) => f.id);

    const scored = recommend({
      profile,
      library,
      candidates,
      friends,
      friendScores: friendScoresMap(db, fids),
      communityScores: communityScores(db),
      limit: candidates.length,
      diversify: false,
    });

    const ph = fids.map(() => '?').join(',') || 'NULL';
    const circle = db
      .prepare(
        `SELECT ui.score, ui.review, ui.updated_at AS at, u.username, u.display_name, i.*
           FROM user_items ui JOIN users u ON u.id = ui.user_id JOIN items i ON i.id = ui.item_id
          WHERE ui.user_id IN (${ph}) AND ui.score >= ?
          ORDER BY ui.updated_at DESC LIMIT 200`
      )
      .all(...fids, CIRCLE_MIN_SCORE)
      .map(({ score, review, at, username, display_name, ...row }) => ({
        item: hydrateItem(row),
        friend: { name: display_name, username },
        score,
        review,
        at,
      }))
      .filter((c) => !mine.has(c.item.id));

    const upcoming = all
      .filter((i) => i.status !== 'released' && mine.get(i.id) !== 'dismissed')
      .map((item) => ({ item, match: toPercent(cosine(profile, itemFeatures(item))), watching: mine.get(item.id) === 'want' }))
      .sort((a, b) => b.watching - a.watching || b.match - a.match);

    const lists = db
      .prepare(
        `SELECT l.id, l.title, l.updated_at, u.display_name AS owner_name, u.username AS owner_username
           FROM lists l JOIN users u ON u.id = l.owner_id
          WHERE l.owner_id IN (${ph}) AND l.visibility <> 'private'`
      )
      .all(...fids);
    const listItems = db.prepare('SELECT i.id, i.title, i.medium, i.image_url FROM list_items li JOIN items i ON i.id = li.item_id WHERE li.list_id = ? ORDER BY li.position');
    const friendLists = lists.map((l) => {
      const items = listItems.all(l.id);
      return { ...l, count: items.length, unseen: items.filter((i) => !mine.has(i.id)).length, covers: items.slice(0, 4) };
    });

    res.json(buildHome({ profile, library, scored, circle, upcoming, friendLists, hasFriends: fids.length > 0, userId: me }));
  });
}

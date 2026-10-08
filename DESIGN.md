# Tastemate: design

> One place to learn your taste across **film, TV, music and books**, get
> recommendations that explain themselves, and share them with friends.

## 1. The problem, restated

- You have **wide taste** (drama, action, comedy, horror, house, rock, folk…).
  Most recommenders are tied to one medium (Netflix, Spotify, Goodreads), so each
  one only sees part of your taste and pushes you toward its own catalogue.
- **Finding good older work is as hard as finding new work.** Streaming feeds
  favour what's new and what they host.
- Advice from **friends you trust** beats an algorithm, but it's spread across
  group chats and gets lost.
- **Upcoming work** (films in production, announced seasons, forthcoming
  albums and books) is hard to track unless you follow industry news.

## 2. Product pillars

| Pillar | What it means in the app |
|---|---|
| **Learns you** | Ratings (1–10), "want", and "not for me" signals build a *taste profile* that covers every medium. You can see and adjust it. |
| **Crosses media** | Items carry shared **mood tags** (dark, cerebral, uplifting, atmospheric, high-energy…) on top of genres, so "loved *True Detective*" can surface a Southern-gothic novel or a moody folk album. |
| **Explains itself** | Every recommendation comes with reasons: *"Because you loved Heat · tense, crime"*, *"Maya rated it 9/10"*. |
| **Social, not a broadcast** | Friends (mutual), lists, reviews with scores, an activity feed, and a **taste-match %** with each friend. |
| **Looks ahead** | A **Radar** of upcoming and in-production titles, ranked against your taste, with a watchlist. |
| **Old and new together** | Recommendations deliberately mix eras and media rather than chasing what's new. |

## 3. Core user journeys

1. **Onboarding (cold start).** Pick the genres and moods you like in each
   medium, then rate a handful of well-known titles. That's enough for useful
   first recommendations.
2. **Discover.** A ranked feed, filterable by medium, with reasons on every
   card. One-tap actions: rate, *Want*, *Not for me*. Each action updates the
   profile immediately.
3. **Search and add.** Search the local catalogue and external sources (TMDB for
   film/TV, Open Library for books, MusicBrainz for music). Importing a result
   adds it to the shared catalogue.
4. **Review.** Score from 1 to 10 plus optional text, visible to friends.
5. **Lists.** "Best folk records for a rainy Sunday" with per-item notes.
   Visibility is private, friends, or public.
6. **Friends.** Send and accept requests, see a friend's lists and reviews, and
   see a taste-match score.
7. **Feed.** What friends rated, reviewed and listed recently.
8. **Radar.** Upcoming and in-production work, ranked by taste, which you can
   add to your watchlist.
9. **Taste DNA.** Your strongest positive and negative tags, with the option to
   pin or ban a tag.

## 4. Recommendation engine (v1: hybrid, explainable, no ML infrastructure)

Each item becomes a sparse feature vector:

```
genre:<g>   weight 1.0   (drama, horror, house, folk, sci-fi …)
mood:<m>    weight 1.2   (shared across media, which is what bridges them)
creator:<c> weight 1.5   (director, author, artist)
era:<decade> weight 0.3
```

**User profile** = Σ over the user's library of `signal × features(item)`:

| Signal | Weight |
|---|---|
| Rating `s` (1–10) | `(s − 5.5) / 4.5` → −1 … +1 |
| *Want* | +0.35 |
| *Not for me* | −0.6 |
| Onboarding / pinned tag | ±1.0 on that tag |

**Candidate score**

```
content  = cosine(profile, item)                                  # what you like
social   = tanh(Σ_friends max(0.15, tasteSim(me, f)) · norm(f.score))  # trusted friends
quality  = Bayesian average of community scores, scaled 0..1
final    = 0.60·content + 0.25·social + 0.15·quality
```

Then a **diversity re-rank** (MMR-style), so a page isn't 20 horror films:
each pick is penalised by its similarity to items already picked, plus a
small boost for media that haven't appeared yet.

**Explanations** come from the top contributing features, mapped back to the
highest-rated items in your library that share them, plus any friend scores.

**Why not collaborative filtering or embeddings yet?** With a small friend
group the rating matrix is very sparse, so content-based scoring plus a
trusted-friends signal works better and is explainable. The scorer sits behind
one function (`recommend()`), so it can later be swapped for embeddings
(e.g. text embeddings of synopses), matrix factorisation, or LLM re-ranking
without touching the API.

## 5. Data model

```
users(id, username, display_name, password_hash, created_at)
sessions(token, user_id, expires_at)
items(id, medium[movie|tv|book|music], title, year, creators[], genres[], moods[],
      description, image_url, status[released|upcoming|in_production|announced],
      release_date, source, external_id, is_demo)
user_items(user_id, item_id, state[want|in_progress|done|dismissed],
           score 1..10?, review?, updated_at)          -- library + ratings + reviews
tag_prefs(user_id, tag, weight)                         -- onboarding / pinned / banned tags
friendships(requester_id, addressee_id, status[pending|accepted], created_at)
lists(id, owner_id, title, description, visibility[private|friends|public], …)
list_items(list_id, item_id, note, position)
```

The feed is computed from `user_items` and `lists`, so there's no separate
events table yet.

## 6. Architecture

```
web/ (React + Vite SPA)  ──/api──▶  server/ (Node + Express)
                                       ├─ SQLite (node:sqlite, a single file)
                                       ├─ recommender.js (pure functions, unit-tested)
                                       └─ providers/ TMDB · Open Library · MusicBrainz
```

- **Why this stack:** one language, no native build steps, a database in a
  single file, and it runs anywhere Node 22 runs. You can move to Postgres later
  by swapping `db.js`.
- **Auth:** username and password (scrypt), plus an opaque session token in an
  httpOnly cookie.
- **External data:** catalogue providers are optional. Without keys the app
  uses a built-in seed catalogue. With `TMDB_API_KEY` set, search and Radar pull
  real film and TV data, including upcoming and in-production titles.
  Imported genres map to moods automatically (`server/taxonomy.js`).

## 7. Privacy and sharing

- Reviews and library entries are visible only to accepted friends. Lists have
  their own visibility setting.
- Friendships are mutual and need an explicit accept.
- No tracking, and nothing is sent to third parties except search queries to
  the catalogue APIs you enable.

## 8. Roadmap

**MVP (this build):** everything in §3, plus the seed catalogue and demo friends.

**Next:**
- Scheduled sync of upcoming releases from TMDB, MusicBrainz and publishers, with
  notifications when something on your watchlist releases or gets a date.
- Import history from Letterboxd, Goodreads, Last.fm and Trakt (CSV/API), the
  fastest cure for cold start.
- "Where to watch / listen" links (JustWatch-style availability, Spotify links).
- Group mode: "pick a film for the four of us tonight" (intersection of profiles).
- Embedding-based similarity on synopses and lyrics; LLM-written "why you'll like
  this" blurbs.
- Mobile app (React Native) and push notifications.
- Postgres plus hosted deployment, invite links, and moderation and reporting
  for public lists.

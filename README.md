# ✦ Tastemate

Cross-media taste profiles for **film, TV, music and books**: recommendations
that explain themselves, a radar of upcoming releases, and lists, reviews and
scores shared with friends.

See [DESIGN.md](DESIGN.md) for the product thinking, the recommendation model,
the data model and the roadmap.

## Quick start

Requires **Node 22.13+**. SQLite is built into Node, so there are no native modules.

```bash
npm install
npm run seed -- --demo   # optional: demo friends (maya, sam, jo) and a `demo` login
npm run dev              # API on :3001, app on http://localhost:5173
```

Sign in as `demo` / `demo1234` to see a profile with friends, a feed and lists
already set up, or create your own account and go through onboarding. To try
the social features with your own account, add `maya`, `sam` or `jo` as friends.

### Production

```bash
npm run build && npm start   # serves the API and the built app on :3001
```

### Configuration

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3001` | HTTP port |
| `DB_FILE` | `data/tastemate.db` | SQLite file |
| `TMDB_API_KEY` | *(unset)* | Enables film/TV search and real upcoming releases on Radar ([get a key](https://www.themoviedb.org/settings/api)) |
| `OPENLIBRARY` | on | Set to `off` to disable book search |
| `MUSICBRAINZ` | on | Set to `off` to disable album search |
| `MUSICBRAINZ_UA` | Tastemate UA | User-Agent that MusicBrainz requires |

## What's in it

- **Onboarding:** pick genres and moods per medium, then rate a few well-known titles.
- **Discover:** a hybrid recommender (taste profile, friends weighted by taste
  similarity, and community quality) with a diversity re-rank so media and genres
  mix. Each card says why it was picked.
- **Radar:** upcoming, announced and in-production titles ranked by your taste, with a watchlist.
- **Search:** the local catalogue plus TMDB, Open Library and MusicBrainz. Import
  results, or add anything by hand.
- **Library:** rate (1–10), review, want, in progress, or mark as not for me.
- **Lists:** mixed-media lists with notes, visible to just you, friends, or everyone.
- **Friends:** mutual friendships, a taste-match %, profiles, and a **feed**.
- **Taste DNA:** see what drives your recommendations, and boost or ban tags.

## Project layout

```
server/
  app.js            Express app (createApp is used by the tests too)
  db.js             schema + helpers (node:sqlite)
  recommender.js    pure scoring / ranking / explanations
  taxonomy.js       genres, moods, genre→mood map, provider genre aliases
  services.js       shared queries (library, friends, profiles)
  routes/           auth, items + library, discover (recs/radar/taste/onboarding), social
  providers/        tmdb, openlibrary, musicbrainz
  seed/             starter catalogue + demo users
web/src/            React SPA (pages/, components/ui.jsx, styles.css)
test/               node:test tests for the recommender, providers (mocked) and API
```

## Tests

```bash
npm test
```

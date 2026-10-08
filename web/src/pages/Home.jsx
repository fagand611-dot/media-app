import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { Cover, Loading, MediumBadge, Reasons, STATUS_LABEL, Score, Tags, timeAgo, useApi } from '../components/ui.jsx';

// The curated "For You" page: one top pick, then themed shelves that each
// explain why they're there.
export default function Home() {
  const state = useApi('/home');
  const { user } = useAuth();
  return (
    <Loading state={state}>
      {({ hero, shelves }) => (
        <div className="home">
          <p className="greeting">{greeting()}, {user.display_name.split(' ')[0]}</p>
          {hero && <Hero {...hero} onDone={state.reload} />}
          {shelves.map((s) => <Shelf key={s.id} shelf={s} />)}
          <div className="browse-all">
            <Link to="/discover" className="button">Browse all recommendations →</Link>
          </div>
        </div>
      )}
    </Loading>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function Hero({ item, match, reasons, onDone }) {
  const [entry, setEntry] = useState(null);
  const act = async (body) => setEntry((await api.put(`/library/${item.id}`, body)).entry);
  return (
    <section className="hero">
      <Link to={`/item/${item.id}`} className="hero-cover"><Cover item={item} /></Link>
      <div className="hero-body">
        <span className="eyebrow">Your top pick right now · {match}% match</span>
        <h1><Link to={`/item/${item.id}`}>{item.title}</Link></h1>
        <p className="sub">
          <MediumBadge medium={item.medium} /> {[item.creators.slice(0, 2).join(', '), item.year].filter(Boolean).join(' · ')}
        </p>
        <Tags item={item} />
        {item.description && <p className="desc">{item.description}</p>}
        <Reasons reasons={reasons} />
        <div className="actions">
          {entry ? (
            <>
              <span className="muted">{entry.state === 'want' ? '✓ Added to your list' : 'Got it, we won’t suggest this again.'}</span>
              <button onClick={onDone}>Show me another</button>
            </>
          ) : (
            <>
              <button className="primary" onClick={() => act({ state: 'want' })}>+ I want this</button>
              <Link to={`/item/${item.id}`} className="button">Rate or review</Link>
              <button className="ghost" onClick={() => act({ state: 'dismissed' })}>Not for me</button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function Shelf({ shelf }) {
  return (
    <section className={`shelf-section shelf-${shelf.id}`}>
      <div className="shelf-head">
        <div>
          <h2>{shelf.kind === 'circle' && <span className="live-dot" aria-hidden />}{shelf.title}</h2>
          <p className="muted small">{shelf.subtitle}</p>
        </div>
        {shelf.more && <Link to={shelf.more} className="muted small">See all →</Link>}
        {shelf.anchor && <Link to={`/item/${shelf.anchor.id}`} className="muted small">About {shelf.anchor.title} →</Link>}
      </div>
      {shelf.kind === 'cta' ? (
        <div className="empty">
          {shelf.message} <Link to={shelf.action.to}>{shelf.action.label} →</Link>
        </div>
      ) : (
        <div className="row-scroll">
          {shelf.kind === 'lists'
            ? shelf.lists.map((l) => <ListTile key={l.id} list={l} />)
            : shelf.kind === 'circle'
              ? shelf.items.map((e) => <CircleCard key={e.item.id} entry={e} />)
              : shelf.items.map((e) => <Tile key={e.item.id} entry={e} />)}
        </div>
      )}
    </section>
  );
}

/** Small "+" / "✓" toggle for adding to your want (or watch) list. */
function WantToggle({ item, initial }) {
  const [on, setOn] = useState(!!initial);
  const toggle = async (e) => {
    e.preventDefault();
    if (on) await api.del(`/library/${item.id}`);
    else await api.put(`/library/${item.id}`, { state: 'want' });
    setOn(!on);
  };
  const upcoming = item.status !== 'released';
  return (
    <button className={`want-toggle ${on ? 'on' : ''}`} onClick={toggle} title={on ? 'Remove' : upcoming ? 'Watch for it' : 'Want'}>
      {on ? '✓' : upcoming ? '🔔' : '+'}
    </button>
  );
}

function Tile({ entry: { item, match, note, watching } }) {
  return (
    <Link to={`/item/${item.id}`} className="tile">
      <div className="tile-cover">
        <Cover item={item} />
        {match != null && <span className="match">{match}%</span>}
        <WantToggle item={item} initial={watching} />
      </div>
      <b className="tile-title">{item.title}</b>
      <span className="tile-note">
        {item.is_demo && <span className="badge demo">demo</span>} {note || STATUS_LABEL[item.status]}
      </span>
    </Link>
  );
}

function CircleCard({ entry: { item, by, match } }) {
  const [first, ...rest] = by;
  const quote = by.find((b) => b.review)?.review;
  return (
    <Link to={`/item/${item.id}`} className="circle-card">
      <div className="circle-cover">
        <Cover item={item} />
        <WantToggle item={item} />
      </div>
      <div className="circle-body">
        <div className="avatars">
          {by.slice(0, 3).map((b) => <span key={b.username} className="avatar" title={b.name}>{b.name[0]}</span>)}
          <span className="muted small">{timeAgo(first.at)}</span>
        </div>
        <p className="circle-line">
          <b>{first.name}</b> rated <Score score={first.score} />
          {rest.length > 0 && <span className="muted"> · also {rest.map((r) => `${r.name} ${r.score}`).join(', ')}</span>}
        </p>
        <b className="tile-title">{item.title}</b>
        <span className="tile-note"><MediumBadge medium={item.medium} />{match != null && ` ${match}% match for you`}</span>
        {quote && <p className="quote small">“{quote}”</p>}
      </div>
    </Link>
  );
}

function ListTile({ list }) {
  return (
    <Link to={`/lists/${list.id}`} className="list-tile">
      <div className="mosaic">{list.covers.map((c) => <Cover key={c.id} item={c} />)}</div>
      <b className="tile-title">{list.title}</b>
      <span className="tile-note">by {list.owner_name} · {list.unseen} new to you</span>
    </Link>
  );
}

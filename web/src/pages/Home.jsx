import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import Icon from '../components/Icon.jsx';
import { saveEntry, useActions } from '../components/actions.jsx';
import { Cover, Loading, MediumBadge, MediumTabs, Reasons, STATUS_LABEL, Score, Tags, timeAgo, useApi } from '../components/ui.jsx';

// The curated "For You" page: a glanceable summary, one top pick, then themed
// rows that each explain why they're there. A single filter narrows every row.
export default function Home() {
  const state = useApi('/home');
  const { user } = useAuth();
  const [medium, setMedium] = useState(null);
  const [acted, setActed] = useState({}); // itemId → entry | null, for instant feedback

  const onChange = (id) => (entry) => setActed((a) => ({ ...a, [id]: entry }));

  return (
    <Loading state={state}>
      {({ hero, shelves }) => {
        const keep = (e) => (!medium || e.item.medium === medium) && acted[e.item.id]?.state !== 'dismissed';
        const visible = shelves
          .map((s) => (s.items ? { ...s, items: s.items.filter(keep) } : s))
          .filter((s) => s.kind === 'cta' || s.kind === 'lists' ? !medium : s.items.length >= (s.kind === 'circle' ? 1 : 2));
        return (
          <div className="home">
            <header className="home-head">
              <div>
                <p className="eyebrow">{dateLine()}</p>
                <h1>{greeting()}, {user.display_name.split(' ')[0]}</h1>
              </div>
              <MediumTabs value={medium} onChange={setMedium} />
            </header>

            <Glance shelves={shelves} />

            {hero && (!medium || hero.item.medium === medium) && (
              <Hero {...hero} entry={acted[hero.item.id]} onChange={onChange(hero.item.id)} onNext={state.reload} />
            )}

            {visible.map((s) => <Shelf key={s.id} shelf={s} acted={acted} onChange={onChange} />)}
            {medium && visible.length === 0 && <div className="empty">Nothing in this filter yet. Try another, or browse everything.</div>}

            <div className="browse-all">
              <Link to="/discover" className="btn btn-outline">Browse all recommendations <Icon name="arrow" size={18} /></Link>
            </div>
          </div>
        );
      }}
    </Loading>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function dateLine() {
  return new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

/** "Today at a glance": counts that jump to their row. */
function Glance({ shelves }) {
  const get = (id) => shelves.find((s) => s.id === id);
  const circle = get('circle');
  const soon = get('soon');
  const mood = get('mood');
  const lists = get('lists');
  const cards = [
    circle?.kind === 'circle' && { to: 'circle', icon: 'users', big: circle.items.length, text: `new from friends`, sub: circle.items[0] && `Latest: ${circle.items[0].by[0].name} on ${circle.items[0].item.title}` },
    circle?.kind === 'cta' && { href: '/friends', icon: 'users', big: '+', text: 'Add friends', sub: 'See what they love here' },
    soon && { to: 'soon', icon: 'clock', big: soon.items.length, text: 'coming soon for you', sub: soon.items[0] && `Top: ${soon.items[0].item.title}` },
    mood && { to: 'mood', icon: 'sparkle', big: mood.title.replace(/^In an? | mood$/g, ''), text: 'mood of the day', sub: `${mood.items.length} picks to match` },
    lists && { to: 'lists', icon: 'list', big: lists.lists.length, text: 'friend lists with new picks', sub: lists.lists[0] && `${lists.lists[0].owner_name}: ${lists.lists[0].title}` },
  ].filter(Boolean);
  const jump = (id) => document.getElementById(`shelf-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <div className="glance" aria-label="Today at a glance">
      {cards.map((c) =>
        c.href ? (
          <Link key={c.text} to={c.href} className="glance-card"><GlanceBody c={c} /></Link>
        ) : (
          <button key={c.text} className="glance-card" onClick={() => jump(c.to)}><GlanceBody c={c} /></button>
        )
      )}
    </div>
  );
}

function GlanceBody({ c }) {
  return (
    <>
      <span className="glance-icon"><Icon name={c.icon} size={18} /></span>
      <span className="glance-big">{c.big}</span>
      <span className="glance-text">{c.text}</span>
      {c.sub && <span className="glance-sub">{c.sub}</span>}
    </>
  );
}

function Hero({ item, match, reasons, entry, onChange, onNext }) {
  const { open, toast } = useActions();
  const act = async (body) => onChange(await saveEntry(item, body, toast));
  return (
    <section className="hero">
      <Link to={`/item/${item.id}`} className="hero-cover"><Cover item={item} /></Link>
      <div className="hero-body">
        <span className="eyebrow accent">Top pick for you · {match}% match</span>
        <h2 className="hero-title"><Link to={`/item/${item.id}`}>{item.title}</Link></h2>
        <p className="sub">
          <MediumBadge medium={item.medium} /> {[item.creators.slice(0, 2).join(', '), item.year].filter(Boolean).join(' · ')}
        </p>
        {item.description && <p className="hero-desc">{item.description}</p>}
        <Tags item={item} />
        <Reasons reasons={reasons} />
        <div className="hero-actions">
          {entry ? (
            <>
              <span className="done-note"><Icon name="check" size={16} /> {entry.state === 'want' ? 'In your Want list' : entry.score ? `Rated ${entry.score}/10` : 'Noted'}</span>
              <button className="btn btn-outline" onClick={onNext}><Icon name="refresh" size={16} /> Next pick</button>
            </>
          ) : (
            <>
              <button className="btn btn-primary" onClick={() => act({ state: 'want' })}><Icon name="plus" size={18} /> Want to try</button>
              <button className="btn btn-outline" onClick={() => open(item, null, onChange)}><Icon name="star" size={16} /> Seen it</button>
              <button className="btn btn-ghost" onClick={() => act({ state: 'dismissed' })}>Not for me</button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function Shelf({ shelf, acted, onChange }) {
  return (
    <section className="shelf-section" id={`shelf-${shelf.id}`}>
      <div className="shelf-head">
        <div>
          <h2>{shelf.kind === 'circle' && <span className="live-dot" aria-hidden />}{shelf.title}</h2>
          <p className="shelf-sub">{shelf.subtitle}</p>
        </div>
        {shelf.more && <Link to={shelf.more} className="see-all">See all <Icon name="chevron" size={16} /></Link>}
        {shelf.anchor && <Link to={`/item/${shelf.anchor.id}`} className="see-all anchor-link">{shelf.anchor.title} <Icon name="chevron" size={16} /></Link>}
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
              ? shelf.items.map((e) => <CircleCard key={e.item.id} entry={e} mine={acted[e.item.id]} onChange={onChange(e.item.id)} />)
              : shelf.items.map((e) => <Tile key={e.item.id} entry={e} mine={acted[e.item.id]} onChange={onChange(e.item.id)} />)}
        </div>
      )}
    </section>
  );
}

/** Corner button on a poster: opens the quick-action sheet. Shows your state once you've acted. */
function QuickButton({ item, mine, watching, onChange }) {
  const { open } = useActions();
  const entry = mine !== undefined ? mine : watching ? { state: 'want' } : null;
  const label = entry?.score ? `★ ${entry.score}` : null;
  return (
    <button
      className={`quick ${entry ? 'on' : ''}`}
      aria-label={`Quick actions for ${item.title}`}
      onClick={(e) => {
        e.preventDefault();
        open(item, entry, onChange);
      }}
    >
      {label || <Icon name={entry?.state === 'want' ? 'check' : 'plus'} size={18} />}
    </button>
  );
}

function Tile({ entry: { item, match, note, watching }, mine, onChange }) {
  return (
    <Link to={`/item/${item.id}`} className="tile">
      <div className="tile-cover">
        <Cover item={item} />
        <QuickButton item={item} mine={mine} watching={watching} onChange={onChange} />
      </div>
      <b className="tile-title">{item.title}</b>
      <span className="tile-note">
        {match != null && <span className="tile-match">{match}%</span>}
        {item.is_demo && <span className="badge demo">demo</span>} {note || STATUS_LABEL[item.status]}
      </span>
    </Link>
  );
}

function CircleCard({ entry: { item, by, match }, mine, onChange }) {
  const [first, ...rest] = by;
  const quote = by.find((b) => b.review)?.review;
  return (
    <Link to={`/item/${item.id}`} className="circle-card">
      <div className="circle-cover">
        <Cover item={item} />
        <QuickButton item={item} mine={mine} onChange={onChange} />
      </div>
      <div className="circle-body">
        <div className="who">
          <span className="avatars">
            {by.slice(0, 3).map((b) => <span key={b.username} className="avatar" title={b.name}>{b.name[0]}</span>)}
          </span>
          <span><b>{first.name}</b>{rest.length > 0 && ` +${rest.length}`}</span>
          <span className="muted small">· {timeAgo(first.at)}</span>
        </div>
        <b className="circle-title">{item.title}</b>
        <span className="circle-meta">
          <Score score={first.score} />
          <MediumBadge medium={item.medium} />
          {match != null && <span className="muted small">{match}% for you</span>}
        </span>
        {quote && <p className="quote">“{quote}”</p>}
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
